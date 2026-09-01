'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddressSearch from './AddressSearch';
import UploadDropzone from './UploadDropzone';
import ColourSwatches from './ColourSwatches';
import BeforeAfterSlider from './BeforeAfterSlider';
import ProgressStages from './ProgressStages';
import PriceEstimate from './PriceEstimate';
import LeadGate, { LeadForm } from './LeadGate';
import { DEFAULT_COLOUR_ID, getColour } from '@/lib/colours';
import { track } from '@/lib/analytics';
import type { HouseFacts, InputSource, PriceBand } from '@/lib/types';

type Tab = 'address' | 'upload';
type Phase = 'input' | 'generating' | 'result';
type Storeys = 1 | 2;

function getUtm(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
    const v = p.get(k);
    if (v) out[k] = v;
  });
  return out;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Composite the Brisbane Rendering logo onto the rendered image before download. */
async function watermark(imageSrc: string, logoSrc: string): Promise<string> {
  const [img, logo] = await Promise.all([loadImg(imageSrc), loadImg(logoSrc)]);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const lw = Math.round(canvas.width * 0.26);
  const lh = Math.round((logo.naturalHeight / logo.naturalWidth) * lw);
  const pad = Math.round(canvas.width * 0.02);
  const x = canvas.width - lw - pad * 1.5;
  const y = canvas.height - lh - pad * 1.5;

  // white rounded backing so the navy logo stays legible on dark walls
  ctx.save();
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = '#ffffff';
  const bx = x - pad * 0.6, by = y - pad * 0.6, bw = lw + pad * 1.2, bh = lh + pad * 1.2, r = pad * 0.6;
  if (typeof (ctx as any).roundRect === 'function') {
    ctx.beginPath();
    (ctx as any).roundRect(bx, by, bw, bh, r);
    ctx.fill();
  } else {
    ctx.fillRect(bx, by, bw, bh);
  }
  ctx.restore();

  ctx.drawImage(logo, x, y, lw, lh);
  return canvas.toDataURL('image/png');
}

export default function Visualiser() {
  const [tab, setTab] = useState<Tab>('address');
  const [phase, setPhase] = useState<Phase>('input');
  const [stage, setStage] = useState(0);

  const [original, setOriginal] = useState<{ url: string; mime: string } | null>(null);
  const [source, setSource] = useState<InputSource>('upload');
  const [address, setAddress] = useState<string | undefined>();
  const [suburb, setSuburb] = useState<string | undefined>();

  const [colourId, setColourId] = useState<string>(DEFAULT_COLOUR_ID);
  const [storeys, setStoreys] = useState<Storeys>(1);
  const [detected, setDetected] = useState<{ type: 'lowset' | 'highset'; confidence: string; reason: string } | null>(null);
  const [storeysOverridden, setStoreysOverridden] = useState(false);
  const [lowConfidence, setLowConfidence] = useState(false);

  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [facts, setFacts] = useState<HouseFacts | undefined>();
  const [price, setPrice] = useState<PriceBand | undefined>();

  const [unlocked, setUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cache = useRef<Map<string, string>>(new Map());
  const originalRef = useRef<{ url: string; mime: string } | null>(null);
  const storeysOverriddenRef = useRef(false);
  const startedAt = useRef<number>(Date.now());
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    track('rmh_start');
    startedAt.current = Date.now();
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, []);

  const runStages = useCallback(() => {
    setStage(0);
    if (stageTimer.current) clearInterval(stageTimer.current);
    stageTimer.current = setInterval(() => setStage((s) => (s < 4 ? s + 1 : s)), 1400);
  }, []);
  const stopStages = useCallback(() => {
    if (stageTimer.current) clearInterval(stageTimer.current);
    setStage(5);
  }, []);

  const generate = useCallback(
    async (colId: string, force = false) => {
      const orig = originalRef.current;
      if (!orig) return;
      if (!force) {
        const cached = cache.current.get(colId);
        if (cached) {
          setCurrent(cached);
          return;
        }
      }
      // Render the DEFAULT colour from the original photo (establishes the
      // house). For every other colour, RECOLOUR that first render so the house
      // stays identical instead of being re-hallucinated from the poor original.
      const base = cache.current.get(DEFAULT_COLOUR_ID);
      const recolour = colId !== DEFAULT_COLOUR_ID && !!base;
      const srcUrl = recolour ? base! : orig.url;
      const srcMime = recolour ? 'image/png' : orig.mime;
      const mode = recolour ? 'recolour' : 'render';

      setError(null);
      setPhase('generating');
      runStages();
      track('rmh_generate_start', { colour: colId, mode, force });
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageBase64: srcUrl, mimeType: srcMime, colourId: colId, mode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Generation failed');
        const outUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
        cache.current.set(colId, outUrl);
        setCurrent(outUrl);
        stopStages();
        setPhase('result');
        track('rmh_generate_complete', { engine: data.engine, ms: data.ms, mocked: data.mocked });
      } catch (e: any) {
        stopStages();
        setPhase('result');
        setError(e?.message || 'Something went wrong. Try again or upload a clearer photo.');
      }
    },
    [runStages, stopStages]
  );

  const fetchEstimate = useCallback(async (s: Storeys) => {
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeys: s }),
      });
      const data = await res.json();
      if (res.ok) {
        setFacts(data.facts);
        setPrice(data.price);
        track('rmh_estimate_shown', { low: data.price.low, high: data.price.high });
      }
    } catch {
      /* non-blocking */
    }
  }, []);

  const classify = useCallback(
    async (url: string, mime: string) => {
      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageBase64: url, mimeType: mime }),
        });
        const d = await res.json();
        if (!res.ok || storeysOverriddenRef.current) return; // don't clobber a manual choice
        setDetected({ type: d.type, confidence: d.confidence, reason: d.reason });
        setStoreys(d.storeys);
        fetchEstimate(d.storeys);
        track('rmh_storeys_detected', { type: d.type, confidence: d.confidence });
      } catch {
        /* non-blocking */
      }
    },
    [fetchEstimate]
  );

  const onImageReady = useCallback(
    (url: string, mime: string, src: InputSource) => {
      originalRef.current = { url, mime };
      setOriginal({ url, mime });
      setSource(src);
      if (src === 'upload') setLowConfidence(false);
      cache.current.clear();
      setUnlocked(false);
      setColourId(DEFAULT_COLOUR_ID);
      storeysOverriddenRef.current = false;
      setStoreysOverridden(false);
      setDetected(null);
      generate(DEFAULT_COLOUR_ID); // base render
      classify(url, mime); // auto-detect lowset/highset (refines the estimate)
      fetchEstimate(storeys); // provisional until classify returns
    },
    [generate, classify, fetchEstimate, storeys]
  );

  const onAddressSelect = useCallback(
    async (r: { address: string; suburb?: string; lat: number; lng: number }) => {
      setAddress(r.address);
      setSuburb(r.suburb);
      track('rmh_address_search', { suburb: r.suburb });
      try {
        const url = `/api/property-image?address=${encodeURIComponent(r.address)}&lat=${r.lat}&lng=${r.lng}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data?.imageBase64 || data.source === 'none') {
          setError(
            "We couldn't find a clear street image of your home — upload a quick photo for the most accurate preview."
          );
          setTab('upload');
          track('rmh_property_image', { source: data?.source || 'none', confidence: data?.confidence });
          return;
        }
        track('rmh_property_image', { source: data.source, confidence: data.confidence });
        onImageReady(`data:${data.mimeType};base64,${data.imageBase64}`, data.mimeType, 'address_streetview');
        setLowConfidence(data.confidence === 'low');
      } catch {
        setError('Could not fetch imagery — please upload a photo.');
        setTab('upload');
      }
    },
    [onImageReady]
  );

  const changeColour = useCallback(
    (id: string) => {
      if (!originalRef.current) return;
      setColourId(id);
      track('rmh_colour_select', { colour: id });
      generate(id); // recolours from the base render; price unaffected by colour
    },
    [generate]
  );

  const changeStoreys = useCallback(
    (s: Storeys) => {
      storeysOverriddenRef.current = true;
      setStoreysOverridden(true);
      setStoreys(s);
      fetchEstimate(s); // price only; no re-render
    },
    [fetchEstimate]
  );

  const regenerate = useCallback(() => {
    if (!originalRef.current) return;
    // Regenerating the base colour invalidates all derived recolours.
    if (colourId === DEFAULT_COLOUR_ID) cache.current.clear();
    else cache.current.delete(colourId);
    generate(colourId, true);
  }, [colourId, generate]);

  const submitLead = useCallback(
    async (form: LeadForm) => {
      setSubmitting(true);
      track('rmh_lead_submit');
      if (form.wantsQuote) track('rmh_quote_requested');
      try {
        await fetch('/api/lead', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            lead: {
              ...form,
              address,
              colourId,
              finish: 'Acrylic render (smooth) + paint',
              facts,
              price,
              source,
              referrer: document.referrer,
              utm: getUtm(),
              device: navigator.userAgent,
              timeSpentMs: Date.now() - startedAt.current,
            },
          }),
        });
      } catch {
        /* best-effort; never block the reveal */
      } finally {
        setUnlocked(true);
        setSubmitting(false);
      }
    },
    [address, colourId, facts, price, source]
  );

  const busy = phase === 'generating';
  const colour = getColour(colourId);

  const downloadAfter = useCallback(async () => {
    if (!current) return;
    track('rmh_image_download');
    let href = current;
    try {
      href = await watermark(current, '/brand/logo.png');
    } catch {
      /* fall back to un-watermarked image */
    }
    const a = document.createElement('a');
    a.href = href;
    a.download = `my-home-rendered-brisbane-rendering-${colourId}.png`;
    a.click();
  }, [current, colourId]);

  const showResult = useMemo(() => phase !== 'input' && original, [phase, original]);

  return (
    <section className="mx-auto max-w-6xl px-5">
      {!showResult ? (
        /* ─── INPUT ─── */
        <div className="mx-auto max-w-2xl animate-fadeup rounded-3xl bg-white/80 p-6 shadow-lift ring-1 ring-black/5 backdrop-blur sm:p-8">
          <div className="mb-5 inline-flex rounded-xl bg-stone-100 p-1">
            {(['address', 'upload'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-medium capitalize transition',
                  tab === t ? 'bg-white shadow-sm' : 'text-stone-500',
                ].join(' ')}
              >
                {t === 'address' ? 'Find my address' : 'Upload a photo'}
              </button>
            ))}
          </div>

          <p className="mb-4 rounded-lg bg-brand/5 px-3 py-2 text-xs text-brand-dark ring-1 ring-brand/15">
            📸 For the most accurate preview, <b>upload a clear, straight-on photo</b> of your home — street
            imagery is often low-resolution or partly blocked, which can affect the result.
          </p>

          {tab === 'address' ? (
            <div className="space-y-4">
              <AddressSearch onSelect={onAddressSelect} />
              <p className="text-xs text-stone-400">
                We&rsquo;ll pull the best available street imagery. For the most realistic result, switch to
                <button className="mx-1 underline" onClick={() => setTab('upload')}>upload a photo</button>.
              </p>
            </div>
          ) : (
            <UploadDropzone onImage={(url, mime) => onImageReady(url, mime, 'upload')} />
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        /* ─── RESULT ─── */
        <div className="grid animate-fadeup gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {lowConfidence && !busy && (
              <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-200">
                This street view may not perfectly show your home. For a more accurate preview,{' '}
                <button
                  className="font-medium underline"
                  onClick={() => {
                    setPhase('input');
                    setTab('upload');
                  }}
                >
                  upload a photo
                </button>
                .
              </div>
            )}
            {busy ? (
              <div className="space-y-4">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={original!.url} alt="Your home" className="h-full w-full object-cover blur-sm" />
                  <div className="absolute inset-0 bg-white/30" />
                </div>
                <ProgressStages activeIndex={stage} />
              </div>
            ) : current && original ? (
              <div className="relative">
                <div className={unlocked ? '' : 'pointer-events-none select-none'}>
                  <div className={unlocked ? '' : 'blur-[6px]'}>
                    <BeforeAfterSlider before={original.url} after={current} loading={false} />
                  </div>
                </div>
                {!unlocked && (
                  <div className="absolute inset-x-0 top-6 mx-auto w-fit rounded-full bg-ink/80 px-4 py-1.5 text-sm text-white shadow-lift">
                    🔒 Enter your details below to reveal the full-resolution result
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={regenerate}
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium shadow ring-1 ring-black/10 hover:bg-stone-50"
                    title="Not quite right? Generate a fresh version."
                  >
                    ↻ Regenerate
                  </button>
                  {unlocked && (
                    <button
                      onClick={downloadAfter}
                      className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium shadow ring-1 ring-black/10 hover:bg-stone-50"
                    >
                      Download image
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>

          <div className="space-y-5">
            <ColourSwatches selectedId={colourId} onSelect={changeColour} busy={busy} />

            <div>
              <h3 className="mb-2 text-sm font-semibold">House type</h3>
              <div className="inline-flex rounded-xl bg-stone-100 p-1">
                {([1, 2] as Storeys[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStoreys(s)}
                    className={[
                      'rounded-lg px-4 py-1.5 text-sm transition',
                      storeys === s ? 'bg-white font-medium shadow-sm' : 'text-stone-500',
                    ].join(' ')}
                  >
                    {s === 1 ? 'Lowset (single)' : 'Highset (double)'}
                  </button>
                ))}
              </div>
              {storeysOverridden ? (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
                  ✎ Manually set — overriding auto-detection
                </p>
              ) : detected ? (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-brand-dark">
                  ✓ Auto-detected as {detected.type === 'highset' ? 'Highset' : 'Lowset'}
                  {detected.confidence !== 'high' ? ' — please confirm' : ''}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-stone-400">Detecting house type…</p>
              )}
            </div>

            <PriceEstimate facts={facts} price={price} />

            {!unlocked ? (
              <LeadGate defaultSuburb={suburb} onSubmit={submitLead} submitting={submitting} />
            ) : (
              <div className="rounded-2xl bg-brand/5 p-5 ring-1 ring-brand/20">
                <h3 className="font-semibold text-brand-dark">You&rsquo;re all set 🎉</h3>
                <p className="mt-1 text-sm text-stone-600">
                  We&rsquo;ve emailed your before &amp; after in {colour.name}. Our team will be in touch about your
                  free fixed quotation.
                </p>
                <button
                  onClick={() => {
                    setPhase('input');
                    setOriginal(null);
                    setCurrent(null);
                    setUnlocked(false);
                  }}
                  className="mt-3 text-sm font-medium text-brand-dark underline"
                >
                  Try another home
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
