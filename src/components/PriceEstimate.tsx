'use client';

import { formatAUD } from '@/lib/pricing';
import type { HouseFacts, PriceBand } from '@/lib/types';

export default function PriceEstimate({ facts, price }: { facts?: HouseFacts; price?: PriceBand }) {
  if (!price) return null;
  return (
    <div className="rounded-2xl bg-ink p-5 text-white shadow-lift">
      <p className="text-xs uppercase tracking-widest text-white/50">Estimated investment</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">
        {formatAUD(price.low)} <span className="text-white/50">–</span> {formatAUD(price.high)}
      </p>
      {facts && (
        <p className="mt-2 text-sm text-white/60">
          {facts.storeys === 1 ? 'Single storey (lowset)' : 'Double storey (highset)'} · render + paint · incl. GST
        </p>
      )}
      <p className="mt-3 text-xs text-white/40">{price.disclaimer}</p>
    </div>
  );
}
