import { haversineMeters } from '@gayatama/scoring';
import { encodeGeohash, geohashBounds, geohashCenter, geohashHalfDiagonalMeters } from '../src/common/geohash';
import { ORIGIN } from './fixtures';

describe('geohash', () => {
  it('encodes the reference example', () => {
    expect(encodeGeohash({ lat: 57.64911, lng: 10.40744 }, 11)).toBe('u4pruydqqvj');
  });

  it('decodes a cell that contains the encoded point', () => {
    const cell = encodeGeohash(ORIGIN, 7);
    const bounds = geohashBounds(cell);
    expect(ORIGIN.lat).toBeGreaterThanOrEqual(bounds.minLat);
    expect(ORIGIN.lat).toBeLessThan(bounds.maxLat);
    expect(ORIGIN.lng).toBeGreaterThanOrEqual(bounds.minLng);
    expect(ORIGIN.lng).toBeLessThan(bounds.maxLng);
    expect(encodeGeohash(geohashCenter(cell), 7)).toBe(cell);
  });

  it('uses cells of roughly 150 m at precision 7', () => {
    const bounds = geohashBounds(encodeGeohash(ORIGIN, 7));
    const height = haversineMeters({ lat: bounds.minLat, lng: bounds.minLng }, { lat: bounds.maxLat, lng: bounds.minLng });
    expect(height).toBeGreaterThan(145);
    expect(height).toBeLessThan(160);
    expect(geohashHalfDiagonalMeters(encodeGeohash(ORIGIN, 7))).toBeCloseTo(107.7, 0);
  });

  it('rejects invalid characters', () => {
    expect(() => geohashBounds('qqa')).toThrow(RangeError);
  });
});
