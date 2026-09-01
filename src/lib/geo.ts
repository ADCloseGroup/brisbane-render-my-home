/**
 * Pure geospatial helpers for the property-image pipeline. No side effects,
 * fully unit-tested (see geo.test.ts).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371000; // Earth radius in metres
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/**
 * Initial great-circle bearing (compass heading, 0–360°, 0=N, 90=E) FROM `from`
 * TO `to`. This is the heading to point a Street View pano at the target house.
 */
export function bearing(from: LatLng, to: LatLng): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/** Great-circle distance in metres (haversine). */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Field of view from pano→target distance: closer needs a wider FOV to fit the
 * façade; further needs a tighter FOV to zoom in.
 *   < 15 m → 90 · 15–30 m → 75 · > 30 m → 60
 */
export function fovForDistance(distanceM: number): 90 | 75 | 60 {
  if (distanceM < 15) return 90;
  if (distanceM <= 30) return 75;
  return 60;
}
