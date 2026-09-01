'use client';

import { DULUX_COLOURS } from '@/lib/colours';

export default function ColourSwatches({
  selectedId,
  onSelect,
  busy,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  busy?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Colour</h3>
        <span className="text-xs text-stone-400">Australia&rsquo;s most popular exterior neutrals</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {DULUX_COLOURS.map((c) => {
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => onSelect(c.id)}
              title={c.name}
              aria-pressed={active}
              className={[
                'group relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition',
                active ? 'ring-2 ring-brand' : 'ring-1 ring-black/5 hover:ring-black/15',
                busy ? 'opacity-60' : '',
              ].join(' ')}
            >
              <span
                className="h-10 w-10 rounded-lg shadow-inner ring-1 ring-black/10 sm:h-12 sm:w-12"
                style={{ backgroundColor: c.hex }}
              />
              <span className="max-w-[72px] text-center text-[10px] leading-tight text-stone-500">
                {c.name.replace('Dulux ', '')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
