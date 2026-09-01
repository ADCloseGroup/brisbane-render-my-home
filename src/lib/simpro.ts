import type { Lead } from './types';

/**
 * Simpro Build API integration — creates a Lead in Simpro from a visualiser
 * submission and attaches the estimate PDF.
 *
 * Verified flow against completely.simprosuite.com, company 11 (Brisbane Rendering):
 *   1. POST /customers/individuals/  { GivenName, FamilyName, Email, Phone }
 *   2. POST /sites/                  { Name, Address:{...} }
 *   3. POST /leads/                  { Customer, Site, LeadName, Notes, FollowUpDate, Salesperson? }
 *   4. POST /leads/{id}/attachments/files/  { Filename, Base64Data }
 *
 * Quirks handled:
 *   - Collection routes need a trailing slash; single-resource routes must NOT.
 *   - Non-ASCII (em-dash, curly quotes) silently breaks the lead POST
 *     ("No data to be inserted") — everything is sanitised to ASCII.
 *   - Lead descriptive field is `LeadName` (not Name/Description); there is no
 *     Value/Source field — those go in Notes.
 */

function cfg() {
  const base = process.env.SIMPRO_BASE_URL;
  const token = process.env.SIMPRO_API_KEY;
  const company = process.env.SIMPRO_COMPANY_ID;
  if (!base || !token || !company) return null;
  return { api: `${base.replace(/\/$/, '')}/api/v1.0/companies/${company}`, token };
}

function ascii(s: string | undefined): string {
  return (s || '')
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x09\x0A\x20-\x7E]/g, '');
}

async function post(api: string, token: string, path: string, body: unknown): Promise<any> {
  const res = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const msg = json?.errors?.map((e: any) => e.message).join('; ') || text.slice(0, 200);
    throw new Error(`Simpro ${path} ${res.status}: ${msg}`);
  }
  return json;
}

export interface SimproResult {
  customerId: number;
  siteId: number;
  leadId: number;
}

export async function createSimproLead(
  lead: Lead,
  colourName: string,
  houseType: string,
  pdfBase64?: string
): Promise<SimproResult | null> {
  const c = cfg();
  if (!c) return null; // not configured → no-op
  const { api, token } = c;

  const parts = (lead.name || '').trim().split(/\s+/);
  const given = ascii(parts.shift() || lead.name) || 'Customer';
  const family = ascii(parts.join(' ')) || given;

  // 1. Customer
  const cust = await post(api, token, '/customers/individuals/', {
    GivenName: given,
    FamilyName: family,
    Email: ascii(lead.email),
    Phone: ascii(lead.phone),
  });
  const customerId = cust.ID;

  // 2. Site
  const site = await post(api, token, '/sites/', {
    Name: ascii(lead.address || `${lead.suburb} (Render My Home)`).slice(0, 250),
    Address: {
      Address: ascii(lead.address || ''),
      City: ascii(lead.suburb || ''),
      State: 'QLD',
    },
  });
  const siteId = site.ID;

  // 3. Lead
  const priceLine = lead.price ? `$${lead.price.low.toLocaleString()} - $${lead.price.high.toLocaleString()}` : 'On application';
  const notes = ascii(
    [
      `Colour: ${colourName}`,
      `House type: ${houseType}`,
      `Indicative estimate: ${priceLine} (incl. render + paint & GST)`,
      `Source: Render My Home visualiser`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone}`,
      lead.wantsQuote ? `Requested a free fixed quotation.` : ``,
    ]
      .filter(Boolean)
      .join('\n')
  );
  const followUp = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const leadRes = await post(api, token, '/leads/', {
    Customer: customerId,
    Site: siteId,
    LeadName: ascii(`Render My Home - ${lead.address || lead.suburb}`).slice(0, 250),
    Notes: notes,
    FollowUpDate: followUp,
  });
  const leadId = leadRes.ID;

  // 4. Attach estimate PDF (best-effort)
  if (pdfBase64) {
    try {
      await post(api, token, `/leads/${leadId}/attachments/files/`, {
        Filename: ascii(`Estimate - ${lead.suburb || 'Render My Home'}.pdf`),
        Base64Data: pdfBase64,
      });
    } catch (e) {
      console.error('[simpro] attachment failed', e);
    }
  }

  return { customerId, siteId, leadId };
}
