import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getColour } from '@/lib/colours';
import { formatAUD } from '@/lib/pricing';
import { generateEstimatePdf } from '@/lib/pdf';
import { createSimproLead } from '@/lib/simpro';
import type { Lead } from '@/lib/types';

export const runtime = 'nodejs';

const PUBLIC_URL = 'https://visualiser.brisbanerendering.com.au';

/**
 * Flat, CRM-friendly payload. GoHighLevel (and Zapier/Make) map top-level keys
 * with zero fuss — name is split, colour resolved to its display name, and the
 * estimate pre-formatted. The full nested `lead` is included for advanced use.
 */
function buildCrmPayload(lead: Lead, beforeUrl?: string, afterUrl?: string) {
  const parts = (lead.name || '').trim().split(/\s+/);
  const first = parts.shift() || lead.name || '';
  const last = parts.join(' ');
  const colourName = getColour(lead.colourId)?.name || lead.colourId;
  const estimate = lead.price ? `${formatAUD(lead.price.low)} – ${formatAUD(lead.price.high)}` : '';
  return {
    type: 'render_my_home.lead',
    createdAt: new Date().toISOString(),
    // Contact
    first_name: first,
    last_name: last,
    full_name: lead.name,
    email: lead.email,
    phone: lead.phone,
    suburb: lead.suburb,
    address: lead.address || '',
    wants_quote: !!lead.wantsQuote,
    // Render details
    colour: colourName,
    finish: lead.finish,
    storeys: lead.facts?.storeys ?? '',
    complexity: lead.facts?.complexity ?? '',
    estimate_low: lead.price?.low ?? '',
    estimate_high: lead.price?.high ?? '',
    estimate_display: estimate,
    before_image_url: beforeUrl || '',
    after_image_url: afterUrl || '',
    // Attribution
    source: lead.source,
    page: PUBLIC_URL,
    utm_source: lead.utm?.utm_source || '',
    utm_medium: lead.utm?.utm_medium || '',
    utm_campaign: lead.utm?.utm_campaign || '',
    referrer: lead.referrer || '',
    // Full nested object for advanced mapping
    lead,
  };
}

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured → skip (dev)
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  }).then((r) => r.json()).catch(() => null);
  return !!res?.success;
}

async function sendEmails(lead: Lead, beforeUrl?: string, afterUrl?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'no RESEND_API_KEY' };

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const from = process.env.LEAD_FROM_EMAIL || 'Brisbane Rendering <onboarding@resend.dev>';

  const priceLine = lead.price ? `$${lead.price.low.toLocaleString()} – $${lead.price.high.toLocaleString()} AUD` : 'On application';
  const imgs = [beforeUrl, afterUrl].filter(Boolean).map((u) => `<img src="${u}" style="max-width:100%;border-radius:12px;margin:8px 0"/>`).join('');

  // To customer
  await resend.emails.send({
    from,
    to: lead.email,
    subject: 'Your rendered home preview — Brisbane Rendering',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">
        <h2>Here's your home, rendered.</h2>
        <p>Hi ${lead.name.split(' ')[0]}, thanks for trying our visualiser.</p>
        ${imgs}
        <p><b>Colour:</b> ${lead.colourId}<br/>
        <b>Finish:</b> ${lead.finish}<br/>
        <b>Indicative investment:</b> ${priceLine}</p>
        <p style="color:#666;font-size:13px">${lead.price?.disclaimer ?? 'Subject to onsite inspection.'}</p>
        <p><b>Next steps:</b> we'll be in touch to arrange your free fixed quotation.</p>
      </div>`,
  }).catch((e) => console.error('[lead] customer email failed', e));

  // Internal
  const internal = process.env.LEAD_INTERNAL_EMAIL;
  if (internal) {
    await resend.emails.send({
      from,
      to: internal,
      subject: `New lead: ${lead.name} — ${lead.suburb} (${priceLine})`,
      html: `<pre style="font-family:ui-monospace,monospace">${JSON.stringify(lead, null, 2)}</pre>${imgs}`,
    }).catch((e) => console.error('[lead] internal email failed', e));
  }
  return { sent: true };
}

async function pushToCRM(lead: Lead, beforeUrl?: string, afterUrl?: string) {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.CRM_WEBHOOK_SECRET ? { 'x-webhook-secret': process.env.CRM_WEBHOOK_SECRET } : {}),
    },
    body: JSON.stringify(buildCrmPayload(lead, beforeUrl, afterUrl)),
  }).catch((e) => console.error('[lead] CRM webhook failed', e));
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'anon';
  let payload: { lead: Lead; turnstileToken?: string; beforeUrl?: string; afterUrl?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { lead } = payload;

  if (!lead?.name || !lead?.email || !lead?.phone || !lead?.suburb) {
    return NextResponse.json({ error: 'Name, email, phone and suburb are required.' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) {
    return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 });
  }

  if (!(await verifyTurnstile(payload.turnstileToken, ip))) {
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 });
  }

  // Persist (best-effort — never block the UX on the DB).
  const supabase = getServiceClient();
  let leadId: string | undefined;
  if (supabase) {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        suburb: lead.suburb,
        wants_quote: lead.wantsQuote,
        address: lead.address,
        colour_id: lead.colourId,
        finish: lead.finish,
        facts: lead.facts,
        price: lead.price,
        source: lead.source,
        referrer: lead.referrer,
        utm: lead.utm,
        device: lead.device,
        time_spent_ms: lead.timeSpentMs,
      })
      .select('id')
      .single();
    if (error) console.error('[lead] supabase insert failed', error);
    else leadId = data?.id;
  }

  // Build the branded estimate PDF (used for Simpro attachment + email).
  const colourName = getColour(lead.colourId)?.name || lead.colourId;
  const houseType = lead.facts?.storeys === 2 ? 'Highset (double)' : 'Lowset (single)';
  let pdfBase64: string | undefined;
  try {
    if (lead.price) {
      pdfBase64 = await generateEstimatePdf({
        name: lead.name,
        address: lead.address,
        suburb: lead.suburb,
        colourName,
        houseType,
        priceLow: lead.price.low,
        priceHigh: lead.price.high,
      });
    }
  } catch (e) {
    console.error('[lead] PDF generation failed', e);
  }

  // Fire side-effects in parallel; never block the response on their failures.
  await Promise.allSettled([
    sendEmails(lead, payload.beforeUrl, payload.afterUrl),
    pushToCRM(lead, payload.beforeUrl, payload.afterUrl),
    createSimproLead(lead, colourName, houseType, pdfBase64).catch((e) =>
      console.error('[lead] Simpro lead creation failed', e)
    ),
  ]);

  return NextResponse.json({ ok: true, leadId });
}
