'use client';

const STAGES = [
  'Finding your home…',
  'Cleaning the image…',
  'Detecting walls…',
  'Applying render…',
  'Painting the colour…',
  'Finalising…',
];

export default function ProgressStages({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="rounded-2xl bg-white/70 p-5 shadow-lift ring-1 ring-black/5 backdrop-blur">
      <div className="relative mb-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand transition-all duration-700"
          style={{ width: `${((activeIndex + 1) / STAGES.length) * 100}%` }}
        />
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>
      <ul className="space-y-1.5 text-sm">
        {STAGES.map((s, i) => (
          <li
            key={s}
            className={
              i < activeIndex
                ? 'text-stone-400 line-through'
                : i === activeIndex
                ? 'font-medium text-ink'
                : 'text-stone-300'
            }
          >
            {i === activeIndex ? '● ' : i < activeIndex ? '✓ ' : '○ '}
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
