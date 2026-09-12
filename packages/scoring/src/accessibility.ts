import { ACCESSIBILITY_WEIGHTS, NEUTRAL_SCORE, PARKING, ROAD_CLASS_SCORE, WALKABILITY } from './constants.js';
import type { AccessibilityResult, EvaluatedFacility, RoadClass, SiteConditions } from './types.js';

// PROPOSED in model 0.1.0 — see "Proposed in model 0.1.0" in docs/methodology.md.

export function roadScore(roadClass: RoadClass | undefined): number {
  return roadClass === undefined ? NEUTRAL_SCORE : ROAD_CLASS_SCORE[roadClass];
}

/** 100 × the distance weight of the nearest usable transit stop; 0 when none is mapped. */
export function transitScore(evaluated: readonly EvaluatedFacility[]): number {
  let best = 0;
  for (const entry of evaluated) {
    if (entry.facility.kind !== 'transit' || entry.dataQuality === 0) continue;
    best = Math.max(best, 100 * entry.distanceWeight * entry.accessFactor);
  }
  return best;
}

/** Neutral when no pedestrian features are counted; each mapped feature adds evidence. */
export function walkabilityScore(pedestrianFeatureCount: number | undefined): number {
  if (pedestrianFeatureCount === undefined) return NEUTRAL_SCORE;
  return Math.min(100, WALKABILITY.base + WALKABILITY.perFeature * Math.max(0, pedestrianFeatureCount));
}

/** Parking within 300 m plus any on-site spaces from the what-if simulator. */
export function parkingScore(evaluated: readonly EvaluatedFacility[], onSiteParkingSpaces = 0): number {
  let spaces = Math.max(0, onSiteParkingSpaces);
  for (const entry of evaluated) {
    if (entry.facility.kind !== 'parking' || entry.distanceMeters > PARKING.radiusMeters) continue;
    const capacity = Math.max(0, entry.facility.capacity ?? PARKING.defaultCapacity);
    spaces += capacity * entry.dataQuality * entry.accessFactor * entry.count;
  }
  return Math.min(100, PARKING.base + PARKING.perSpace * spaces);
}

export function accessibility(
  evaluated: readonly EvaluatedFacility[],
  site: SiteConditions = {},
  onSiteParkingSpaces?: number,
): AccessibilityResult {
  const road = roadScore(site.roadClass);
  const transit = transitScore(evaluated);
  const walkability = walkabilityScore(site.pedestrianFeatureCount);
  const parking = parkingScore(evaluated, onSiteParkingSpaces);
  return {
    value:
      ACCESSIBILITY_WEIGHTS.road * road +
      ACCESSIBILITY_WEIGHTS.transit * transit +
      ACCESSIBILITY_WEIGHTS.walkability * walkability +
      ACCESSIBILITY_WEIGHTS.parking * parking,
    road,
    transit,
    walkability,
    parking,
  };
}
