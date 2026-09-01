import type { LatLng } from './geo';

/**
 * Server-side Google Maps Platform imagery helpers. All calls use the
 * server-only key (GOOGLE_STREETVIEW_API_KEY) — never the client bundle.
 * Requires these APIs enabled on the key: Geocoding, Street View Static.
 */
const KEY = () => process.env.GOOGLE_STREETVIEW_API_KEY || '';

export type LocationType = 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE' | 'HINT' | 'UNKNOWN';

export interface GeocodeResult {
  coords: LatLng;
  locationType: LocationType;
}

/** Geocode an address server-side. Returns null on failure (e.g. Geocoding API not enabled). */
export async function geocode(address: string): Promise<GeocodeResult | null> {
  const key = KEY();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=au&key=${key}`;
  const data = await fetch(url).then((r) => r.json()).catch(() => null);
  if (!data || data.status !== 'OK' || !data.results?.length) return null;
  const best = data.results[0];
  const loc = best.geometry?.location;
  if (!loc) return null;
  return {
    coords: { lat: loc.lat, lng: loc.lng },
    locationType: (best.geometry?.location_type as LocationType) || 'UNKNOWN',
  };
}

export interface PanoMeta {
  status: string;
  panoId?: string;
  panoLoc?: LatLng;
}

/**
 * Street View metadata (FREE, no image quota). `source=outdoor` avoids indoor
 * business panos. Returns the nearest pano's own location so we can aim at the house.
 */
export async function panoMetadata(target: LatLng): Promise<PanoMeta> {
  const key = KEY();
  if (!key) return { status: 'NO_KEY' };
  const url =
    `https://maps.googleapis.com/maps/api/streetview/metadata?location=${target.lat},${target.lng}` +
    `&source=outdoor&key=${key}`;
  const data = await fetch(url).then((r) => r.json()).catch(() => null);
  if (!data) return { status: 'FETCH_ERROR' };
  return {
    status: data.status,
    panoId: data.pano_id,
    panoLoc: data.location ? { lat: data.location.lat, lng: data.location.lng } : undefined,
  };
}

export interface StreetViewImage {
  base64: string;
  mimeType: 'image/jpeg';
}

/** Fetch the Static image for a SPECIFIC pano aimed with a computed heading/fov. */
export async function fetchStreetViewByPano(opts: {
  panoId: string;
  heading: number;
  fov: number;
  size?: string;
}): Promise<StreetViewImage | null> {
  const key = KEY();
  if (!key) return null;
  const size = opts.size || '640x640'; // Street View Static standard-tier max
  const url =
    `https://maps.googleapis.com/maps/api/streetview?size=${size}` +
    `&pano=${encodeURIComponent(opts.panoId)}` +
    `&heading=${Math.round(opts.heading)}&pitch=0&fov=${opts.fov}` +
    `&return_error_code=true&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return { base64: buf.toString('base64'), mimeType: 'image/jpeg' };
}
