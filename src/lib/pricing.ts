import type { HouseFacts, PriceBand } from './types';

/**
 * Pricing anchored to Brisbane Rendering's OWN published guide
 * (brisbanerendering.com.au — "created from actual houses", inc GST).
 * We quote RENDER + PAINT combined, because the visualiser shows a finished wall.
 *
 *   Single storey (lowset) : render $8,900–$12,900 + paint $4,400–$5,450 = $13,300–$18,350
 *   Two storey   (highset) : render $14,820–$24,800 + paint $5,650–$7,330 = $20,470–$32,130
 */
interface Band { low: number; high: number }

const STOREY_BAND: Record<1 | 2, Band> = {
  1: { low: 13300, high: 18350 },
  2: { low: 20470, high: 32130 },
};

// Bands already span simple→complex houses, so keep the nudge gentle.
const COMPLEXITY_MULT: Record<HouseFacts['complexity'], number> = {
  simple: 0.92,
  moderate: 1.0,
  complex: 1.12,
};

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function estimatePrice(facts: HouseFacts): PriceBand {
  const base = STOREY_BAND[facts.storeys] ?? STOREY_BAND[1];
  const m = COMPLEXITY_MULT[facts.complexity];

  return {
    low: roundTo(base.low * m, 50),
    high: roundTo(base.high * m, 50),
    currency: 'AUD',
    disclaimer: 'Indicative only, incl. render + paint & GST. Final quotation subject to onsite inspection.',
  };
}

export function formatAUD(n: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(n);
}
