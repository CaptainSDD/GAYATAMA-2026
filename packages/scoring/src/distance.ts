import { ZONE_LIMITS_METERS, ZONE_WEIGHTS } from './constants.js';
import type { LatLng, Zone } from './types.js';

const EARTH_RADIUS_METERS = 6_371_008.8;
const ZONE_ORDER: readonly Zone[] = ['a', 'b', 'c'];

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Straight-line (great-circle) distance, the documented fallback for network routing. */
export function haversineMeters(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Zone for a distance, or `null` beyond the 1,500 m analysis radius. */
export function zoneFor(distanceMeters: number): Zone | null {
  for (const zone of ZONE_ORDER) {
    if (distanceMeters <= ZONE_LIMITS_METERS[zone]) return zone;
  }
  return null;
}

/** Distance weight of a zone. `zoneCWeight` overrides Zone C for the delivery simulation. */
export function zoneWeight(zone: Zone, zoneCWeight?: number): number {
  return zone === 'c' && zoneCWeight !== undefined ? zoneCWeight : ZONE_WEIGHTS[zone];
}
