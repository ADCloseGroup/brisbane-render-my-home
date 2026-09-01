import { describe, it, expect } from 'vitest';
import { bearing, haversineMetres, fovForDistance } from './geo';

describe('bearing', () => {
  it('points due north', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 5);
  });
  it('points due east', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 5);
  });
  it('points due south', () => {
    expect(bearing({ lat: 1, lng: 0 }, { lat: 0, lng: 0 })).toBeCloseTo(180, 5);
  });
  it('points due west', () => {
    expect(bearing({ lat: 0, lng: 1 }, { lat: 0, lng: 0 })).toBeCloseTo(270, 5);
  });
  it('across-the-street case: pano just south of the house → heading ~north', () => {
    // Pano on the road, house set back to the north (higher latitude in QLD, both negative).
    const pano = { lat: -27.46030, lng: 153.00000 };
    const house = { lat: -27.46012, lng: 153.00000 };
    expect(bearing(pano, house)).toBeCloseTo(0, 1);
  });
  it('diagonal NE case is between 0 and 90', () => {
    const b = bearing({ lat: -27.4603, lng: 153.0 }, { lat: -27.4601, lng: 153.0003 });
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(90);
  });
});

describe('haversineMetres', () => {
  it('is ~0 for the same point', () => {
    expect(haversineMetres({ lat: -27.46, lng: 153 }, { lat: -27.46, lng: 153 })).toBeCloseTo(0, 3);
  });
  it('~111.2 km for 1° of latitude', () => {
    const d = haversineMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
  it('typical pano→house distance is a few tens of metres', () => {
    const d = haversineMetres({ lat: -27.4603, lng: 153.0 }, { lat: -27.46012, lng: 153.0 });
    expect(d).toBeGreaterThan(15);
    expect(d).toBeLessThan(30);
  });
});

describe('fovForDistance', () => {
  it('wide FOV up close', () => expect(fovForDistance(10)).toBe(90));
  it('mid FOV at the 15m boundary', () => expect(fovForDistance(15)).toBe(75));
  it('mid FOV at 30m boundary', () => expect(fovForDistance(30)).toBe(75));
  it('tight FOV far away', () => expect(fovForDistance(45)).toBe(60));
});
