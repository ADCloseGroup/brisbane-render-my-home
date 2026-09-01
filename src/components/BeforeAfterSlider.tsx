'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Drag-to-compare before/after. Works with mouse, touch (pinch handled by the
 * browser when fullscreen), and keyboard. `before` and `after` are image src
 * (data URL or http URL).
 */
export default function BeforeAfterSlider({
  before,
  after,
  loading,
}: {
  before: string;
  after: string;
  loading?: boolean;
}) {
  const [pos, setPos] = useState(50);
  const [fs, setFs] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  return (
    <div
      className={[
        'relative select-none',
        fs ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4' : '',
      ].join(' ')}
    >
      <div
        ref={wrapRef}
        className={[
          'relative overflow-hidden rounded-2xl bg-stone-100 shadow-lift ring-1 ring-black/10',
          fs ? 'max-h-full max-w-full' : 'aspect-[4/3] w-full',
        ].join(' ')}
        onMouseDown={(e) => {
          dragging.current = true;
          setFromClientX(e.clientX);
        }}
        onMouseMove={(e) => dragging.current && setFromClientX(e.clientX)}
        onMouseUp={() => (dragging.current = false)}
        onMouseLeave={() => (dragging.current = false)}
        onTouchStart={(e) => setFromClientX(e.touches[0].clientX)}
        onTouchMove={(e) => setFromClientX(e.touches[0].clientX)}
      >
        {/* AFTER (full) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="Rendered result" className="absolute inset-0 h-full w-full object-cover" draggable={false} />

        {/* BEFORE (clipped to the left of the handle) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={before}
            alt="Your home before"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ width: wrapRef.current ? wrapRef.current.clientWidth : '100%', maxWidth: 'none' }}
            draggable={false}
          />
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">Before</span>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-brand/90 px-2.5 py-1 text-xs font-medium text-white">After</span>

        {/* Handle */}
        <div className="absolute inset-y-0" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
          <div className="h-full w-0.5 bg-white shadow" />
          <div className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lift ring-1 ring-black/10">
            <span className="text-ink">⇔</span>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        )}

        {/* keyboard access */}
        <input
          aria-label="Compare before and after"
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="rmh-slider absolute inset-x-0 bottom-0 h-full w-full opacity-0"
        />
      </div>

      <div className={['flex gap-2', fs ? 'absolute right-6 top-6' : 'mt-3 justify-end'].join(' ')}>
        <button
          type="button"
          onClick={() => setFs((v) => !v)}
          className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-medium shadow ring-1 ring-black/10 hover:bg-white"
        >
          {fs ? 'Close' : 'Fullscreen'}
        </button>
      </div>
    </div>
  );
}
