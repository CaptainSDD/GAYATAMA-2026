import { SUPPORTING_CAP, SUPPORTING_POINTS } from './constants.js';
import type { BusinessType, EvaluatedFacility } from './types.js';

// PROPOSED in model 0.1.0 — see "Proposed in model 0.1.0" in docs/methodology.md.

/**
 * Supporting Facility Fit = min(100, Σ Points × Distance Weight × Access Factor
 *                                  × Data Quality × Facility Scale)
 */
export function supportingFacilityFit(evaluated: readonly EvaluatedFacility[], businessType: BusinessType): number {
  let total = 0;
  for (const entry of evaluated) {
    const points = SUPPORTING_POINTS[entry.facility.kind]?.[businessType];
    if (points === undefined || points === 0) continue;
    total += points * entry.distanceWeight * entry.accessFactor * entry.dataQuality * entry.scaleFactor;
  }
  return Math.min(SUPPORTING_CAP, total);
}
