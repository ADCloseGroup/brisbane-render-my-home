import { NextRequest, NextResponse } from 'next/server';
import { estimatePrice } from '@/lib/pricing';
import type { HouseFacts } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * Price estimate from storeys (lowset=1 / highset=2). Deliberately a WIDE band
 * anchored to Brisbane Rendering's published guide — a single front photo
 * cannot yield exact m², so we quote honestly and defer to onsite inspection.
 */
export async function POST(req: NextRequest) {
  let body: { storeys?: number; complexity?: HouseFacts['complexity'] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const storeys = (Math.min(2, Math.max(1, Math.round(body.storeys ?? 1))) as 1 | 2);
  const complexity = body.complexity ?? 'moderate';

  // Rough renderable façade area (internal only; not shown to the customer).
  const wallAreaM2 = storeys === 1 ? 140 : 260;

  const facts: HouseFacts = { storeys, wallAreaM2, complexity };
  const price = estimatePrice(facts);
  return NextResponse.json({ facts, price });
}
