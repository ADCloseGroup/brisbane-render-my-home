import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./googleImagery', () => ({
  geocode: vi.fn(),
  panoMetadata: vi.fn(),
  fetchStreetViewByPano: vi.fn(),
}));

import * as img from './googleImagery';
import { acquirePropertyImage } from './propertyImage';

const geocode = img.geocode as unknown as ReturnType<typeof vi.fn>;
const panoMetadata = img.panoMetadata as unknown as ReturnType<typeof vi.fn>;
const fetchStreetViewByPano = img.fetchStreetViewByPano as unknown as ReturnType<typeof vi.fn>;

const TARGET = { lat: -27.4601, lng: 153.0 };

beforeEach(() => {
  vi.clearAllMocks();
  fetchStreetViewByPano.mockResolvedValue({ base64: 'IMG', mimeType: 'image/jpeg' });
});

describe('acquirePropertyImage cascade', () => {
  it('returns none when the address cannot be located and no hint given', async () => {
    geocode.mockResolvedValue(null);
    const r = await acquirePropertyImage('nowhere', undefined);
    expect(r.source).toBe('none');
    expect(r.imageBase64).toBeNull();
    expect(panoMetadata).not.toHaveBeenCalled();
  });

  it('falls back to the lat/lng hint when geocode fails', async () => {
    geocode.mockResolvedValue(null);
    panoMetadata.mockResolvedValue({ status: 'ZERO_RESULTS' });
    const r = await acquirePropertyImage('addr', TARGET);
    expect(panoMetadata).toHaveBeenCalledWith(TARGET);
    expect(r.source).toBe('none'); // no pano
  });

  it('returns none when there is no Street View pano', async () => {
    geocode.mockResolvedValue({ coords: TARGET, locationType: 'ROOFTOP' });
    panoMetadata.mockResolvedValue({ status: 'ZERO_RESULTS' });
    const r = await acquirePropertyImage('addr', undefined);
    expect(r.source).toBe('none');
    expect(fetchStreetViewByPano).not.toHaveBeenCalled();
  });

  it('rejects a pano further than the max distance', async () => {
    geocode.mockResolvedValue({ coords: TARGET, locationType: 'ROOFTOP' });
    panoMetadata.mockResolvedValue({ status: 'OK', panoId: 'P', panoLoc: { lat: -27.4607, lng: 153.0 } }); // ~66m
    const r = await acquirePropertyImage('addr', undefined);
    expect(r.source).toBe('none');
    expect(r.meta?.distanceM).toBeGreaterThan(50);
    expect(fetchStreetViewByPano).not.toHaveBeenCalled();
  });

  it('rooftop geocode + close pano → streetview, high confidence, computed heading', async () => {
    geocode.mockResolvedValue({ coords: TARGET, locationType: 'ROOFTOP' });
    panoMetadata.mockResolvedValue({ status: 'OK', panoId: 'P', panoLoc: { lat: -27.46019, lng: 153.0 } }); // ~10m
    const r = await acquirePropertyImage('addr', undefined);
    expect(r.source).toBe('streetview');
    expect(r.confidence).toBe('high');
    expect(r.imageBase64).toBe('IMG');
    const arg = fetchStreetViewByPano.mock.calls[0][0];
    expect(arg.panoId).toBe('P');
    expect(typeof arg.heading).toBe('number');
    expect(arg.fov).toBe(90); // <15m
  });

  it('interpolated geocode + mid-distance pano → medium confidence', async () => {
    geocode.mockResolvedValue({ coords: TARGET, locationType: 'RANGE_INTERPOLATED' });
    panoMetadata.mockResolvedValue({ status: 'OK', panoId: 'P', panoLoc: { lat: -27.4603, lng: 153.0 } }); // ~22m
    const r = await acquirePropertyImage('addr', undefined);
    expect(r.source).toBe('streetview');
    expect(r.confidence).toBe('medium');
    expect(r.meta?.fov).toBe(75); // 15–30m
  });
});
