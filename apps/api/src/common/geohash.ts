import { haversineMeters, type LatLng } from '@gayatama/scoring';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export interface CellBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function encodeGeohash(point: LatLng, precision: number): string {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let hash = '';
  let bits = 0;
  let value = 0;
  let longitudeBit = true;

  while (hash.length < precision) {
    if (longitudeBit) {
      const mid = (minLng + maxLng) / 2;
      if (point.lng >= mid) {
        value = value * 2 + 1;
        minLng = mid;
      } else {
        value *= 2;
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (point.lat >= mid) {
        value = value * 2 + 1;
        minLat = mid;
      } else {
        value *= 2;
        maxLat = mid;
      }
    }
    longitudeBit = !longitudeBit;
    bits += 1;
    if (bits === 5) {
      hash += BASE32.charAt(value);
      bits = 0;
      value = 0;
    }
  }
  return hash;
}

export function geohashBounds(hash: string): CellBounds {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let longitudeBit = true;

  for (const char of hash) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new RangeError(`Invalid geohash character "${char}"`);
    for (let shift = 4; shift >= 0; shift -= 1) {
      const set = ((index >> shift) & 1) === 1;
      if (longitudeBit) {
        const mid = (minLng + maxLng) / 2;
        if (set) minLng = mid;
        else maxLng = mid;
      } else {
        const mid = (minLat + maxLat) / 2;
        if (set) minLat = mid;
        else maxLat = mid;
      }
      longitudeBit = !longitudeBit;
    }
  }
  return { minLat, maxLat, minLng, maxLng };
}

export function geohashCenter(hash: string): LatLng {
  const bounds = geohashBounds(hash);
  return { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 };
}

/** Distance from a cell's centre to its farthest corner. */
export function geohashHalfDiagonalMeters(hash: string): number {
  const bounds = geohashBounds(hash);
  const center = geohashCenter(hash);
  const corners: LatLng[] = [
    { lat: bounds.minLat, lng: bounds.minLng },
    { lat: bounds.minLat, lng: bounds.maxLng },
    { lat: bounds.maxLat, lng: bounds.minLng },
    { lat: bounds.maxLat, lng: bounds.maxLng },
  ];
  return Math.max(...corners.map((corner) => haversineMeters(center, corner)));
}
