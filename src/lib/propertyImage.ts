import { bearing, haversineMetres, fovForDistance, type LatLng } from './geo';
import { geocode, panoMetadata, fetchStreetViewByPano, type LocationType } from './googleImagery';

export type ImageSource = 'domain' | 'streetview' | 'none';
export type Confidence = 'high' | 'medium' | 'low';

export interface PropertyImageResult {
  imageBase64: string | null;
  mimeType?: string;
  source: ImageSource;
  confidence: Confidence;
  reason?: string;
  meta?: {
    locationType?: LocationType;
    panoId?: string;
    heading?: number;
    fov?: number;
    distanceM?: number;
  };
}

const PANO_MAX_DISTANCE_M = Number(process.env.PANO_MAX_DISTANCE_M || 50);

/**
 * Acquire the best front-of-house image for a typed address.
 * Cascade: (Domain — currently disabled) → corrected Street View → none.
 * No browser geolocation is ever used; the caller supplies the typed address
 * (and optionally a lat/lng hint from Places autocomplete).
 */
export async function acquirePropertyImage(
  address: string,
  hint?: LatLng
): Promise<PropertyImageResult> {
  // 1. Resolve coordinates + geocode confidence (server-side; falls back to hint).
  const geo = address ? await geocode(address) : null;
  const coords: LatLng | undefined = geo?.coords ?? hint;
  const locationType: LocationType = geo?.locationType ?? (hint ? 'HINT' : 'UNKNOWN');

  if (!coords) {
    return { imageBase64: null, source: 'none', confidence: 'low', reason: 'Could not locate the address.' };
  }

  // 2. (Domain tier intentionally skipped — DOMAIN_ENABLED not set.)

  // 3. Street View with corrected heading.
  const meta = await panoMetadata(coords);
  if (meta.status !== 'OK' || !meta.panoId || !meta.panoLoc) {
    return {
      imageBase64: null,
      source: 'none',
      confidence: 'low',
      reason: `No Street View pano (${meta.status}).`,
      meta: { locationType },
    };
  }

  const distanceM = haversineMetres(meta.panoLoc, coords);
  if (distanceM > PANO_MAX_DISTANCE_M) {
    return {
      imageBase64: null,
      source: 'none',
      confidence: 'low',
      reason: `Nearest pano is ${Math.round(distanceM)}m away (> ${PANO_MAX_DISTANCE_M}m).`,
      meta: { locationType, panoId: meta.panoId, distanceM },
    };
  }

  const heading = bearing(meta.panoLoc, coords);
  const fov = fovForDistance(distanceM);
  const img = await fetchStreetViewByPano({ panoId: meta.panoId, heading, fov });
  if (!img) {
    return {
      imageBase64: null,
      source: 'none',
      confidence: 'low',
      reason: 'Street View image fetch failed.',
      meta: { locationType, panoId: meta.panoId, heading, fov, distanceM },
    };
  }

  // 4. Confidence from geocode quality + pano distance.
  const rooftop = locationType === 'ROOFTOP';
  let confidence: Confidence;
  if (rooftop && distanceM <= 15) confidence = 'high';
  else if (distanceM > 30 || locationType === 'APPROXIMATE') confidence = 'low';
  else confidence = 'medium';

  return {
    imageBase64: img.base64,
    mimeType: img.mimeType,
    source: 'streetview',
    confidence,
    meta: { locationType, panoId: meta.panoId, heading, fov, distanceM },
  };
}
