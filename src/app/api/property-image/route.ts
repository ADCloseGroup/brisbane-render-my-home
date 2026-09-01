import { NextRequest, NextResponse } from 'next/server';
import { acquirePropertyImage } from '@/lib/propertyImage';
import type { LatLng } from '@/lib/geo';

export const runtime = 'nodejs';
export const maxDuration = 26;

/**
 * GET /api/property-image?address=...&lat=...&lng=...
 * Runs the server-side image-acquisition cascade (Domain → corrected Street
 * View → none) and returns { imageBase64|null, mimeType, source, confidence, meta }.
 *
 * No browser geolocation is ever requested — the customer types an address and
 * everything else happens here, server-side.
 *
 * Feature flag IMAGE_CASCADE_ENABLED (default on): set to "false" to fall back
 * to the naive location-based Street View request for A/B comparison.
 */
export async function GET(req: NextRequest) {
  if (process.env.STREETVIEW_RENDER_ENABLED === 'false') {
    return NextResponse.json(
      { imageBase64: null, source: 'none', confidence: 'low', reason: 'Street View disabled — please upload a photo.' },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(req.url);
  const address = (searchParams.get('address') || '').trim();
  const latRaw = searchParams.get('lat');
  const lngRaw = searchParams.get('lng');
  const hint: LatLng | undefined =
    latRaw && lngRaw && !Number.isNaN(Number(latRaw)) && !Number.isNaN(Number(lngRaw))
      ? { lat: Number(latRaw), lng: Number(lngRaw) }
      : undefined;

  if (!address && !hint) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  }

  // Legacy behaviour for A/B comparison.
  if (process.env.IMAGE_CASCADE_ENABLED === 'false') {
    const legacy = await legacyStreetView(hint ? `${hint.lat},${hint.lng}` : address);
    console.log('[property-image] source=streetview-legacy confidence=n/a', { address });
    return NextResponse.json(legacy, { status: 200 });
  }

  try {
    const result = await acquirePropertyImage(address, hint);
    // Server-side telemetry to tune thresholds (Task 3.3).
    console.log('[property-image]', {
      address,
      source: result.source,
      confidence: result.confidence,
      distanceM: result.meta?.distanceM,
      heading: result.meta?.heading,
      locationType: result.meta?.locationType,
      reason: result.reason,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error('[property-image] error', err);
    return NextResponse.json(
      { imageBase64: null, source: 'none', confidence: 'low', reason: 'Lookup failed.' },
      { status: 200 }
    );
  }
}

// Old naive path: metadata check + fetch by location (no heading correction).
async function legacyStreetView(location: string) {
  const key = process.env.GOOGLE_STREETVIEW_API_KEY;
  if (!key) return { imageBase64: null, source: 'none', confidence: 'low', reason: 'not configured' };
  const meta = await fetch(
    `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(location)}&key=${key}`
  ).then((r) => r.json()).catch(() => null);
  if (!meta || meta.status !== 'OK') {
    return { imageBase64: null, source: 'none', confidence: 'low', reason: `no pano (${meta?.status})` };
  }
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${encodeURIComponent(location)}&fov=80&pitch=0&return_error_code=true&key=${key}`
  );
  if (!res.ok) return { imageBase64: null, source: 'none', confidence: 'low', reason: 'fetch failed' };
  const buf = Buffer.from(await res.arrayBuffer());
  return { imageBase64: buf.toString('base64'), mimeType: 'image/jpeg', source: 'streetview', confidence: 'medium' };
}
