'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Address on-ramp using the NEW Places API — `PlaceAutocompleteElement`.
 *
 * Projects created after March 2025 CANNOT use the legacy Autocomplete widget
 * (REQUEST_DENIED), so this uses the modern web component (Places API New).
 *
 * Robustness notes:
 *  - Runs setup EXACTLY ONCE (initedRef + [key] deps + onSelect via ref) so a
 *    parent re-render can't tear down / re-enter the async init mid-flight.
 *  - Retries importLibrary to survive a cold-load race.
 *  - Logs the real error to the console before showing the fallback.
 */
declare global {
  interface Window {
    google?: any;
    __rmhMapsLoading?: Promise<void>;
  }
}

function loadMaps(key: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (window.__rmhMapsLoading) return window.__rmhMapsLoading;
  window.__rmhMapsLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&libraries=places&loading=async`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      window.__rmhMapsLoading = undefined; // allow a later retry
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(s);
  });
  return window.__rmhMapsLoading;
}

export default function AddressSearch({
  onSelect,
}: {
  onSelect: (r: { address: string; suburb?: string; lat: number; lng: number }) => void;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const initedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!key || initedRef.current) return;
    initedRef.current = true;
    let disposed = false;

    async function handleSelect(place: any) {
      try {
        await place.fetchFields({ fields: ['formattedAddress', 'location', 'addressComponents'] });
        if (!place.location) return;
        const comps: any[] = place.addressComponents || [];
        const suburb =
          comps.find((c) => c.types?.includes('locality'))?.longText ||
          comps.find((c) => c.types?.includes('sublocality'))?.longText;
        onSelectRef.current({
          address: place.formattedAddress,
          suburb,
          lat: place.location.lat(),
          lng: place.location.lng(),
        });
      } catch (e) {
        console.error('[AddressSearch] fetchFields failed', e);
        setErr('Could not read that address — please try uploading a photo.');
      }
    }

    (async () => {
      try {
        await loadMaps(key);
        // Survive a cold-start race where importLibrary isn't ready yet.
        let places: any;
        for (let i = 0; i < 3; i++) {
          try {
            places = await window.google.maps.importLibrary('places');
            break;
          } catch (e) {
            if (i === 2) throw e;
            await new Promise((r) => setTimeout(r, 400));
          }
        }
        if (disposed || !hostRef.current) return;

        const el = new places.PlaceAutocompleteElement({ includedRegionCodes: ['au'] });
        el.style.width = '100%';
        hostRef.current.innerHTML = '';
        hostRef.current.appendChild(el);

        // Current API fires 'gmp-select' (placePrediction); older builds fired
        // 'gmp-placeselect' (place). Support both.
        el.addEventListener('gmp-select', (ev: any) => {
          const place = ev.placePrediction?.toPlace?.();
          if (place) handleSelect(place);
        });
        el.addEventListener('gmp-placeselect', (ev: any) => {
          if (ev.place) handleSelect(ev.place);
        });

        setReady(true);
      } catch (e) {
        console.error('[AddressSearch] init failed', e);
        if (!disposed) setErr('Address search is unavailable right now — please upload a photo instead.');
      }
    })();

    return () => {
      disposed = true;
    };
  }, [key]);

  if (!key) {
    return (
      <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
        Address search needs a Google Maps key. For now, use <b>Upload a photo</b> — it also gives the most
        realistic result.
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Enter your address</label>
      <div ref={hostRef} className="rmh-pac w-full" />
      {!ready && !err && <p className="mt-1 text-xs text-stone-400">Loading map services…</p>}
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}

      <style jsx global>{`
        .rmh-pac gmp-place-autocomplete {
          width: 100%;
          --gmp-place-autocomplete-input-border-radius: 0.75rem;
        }
      `}</style>
    </div>
  );
}
