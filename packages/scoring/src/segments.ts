import { SEGMENT_CAP, SEGMENT_POINTS, SEGMENT_ROLE_THRESHOLDS, SEGMENTS } from './constants.js';
import { zoneWeight } from './distance.js';
import { atLeast } from './math.js';
import type { EvaluatedFacility, Segment, SegmentRole, SegmentScores } from './types.js';

/**
 * Segment Score = min(100, Σ Facility Points × Distance Weight × Access Factor
 *                         × Data Quality × Facility Scale)
 *
 * Facilities are indicators of segment strength, never head counts.
 */
export function segmentScores(evaluated: readonly EvaluatedFacility[], zoneCWeight?: number): SegmentScores {
  const totals: SegmentScores = { student: 0, office: 0, resident: 0, commuter: 0, health: 0, general: 0 };

  for (const entry of evaluated) {
    const points = SEGMENT_POINTS[entry.facility.kind];
    if (points === undefined) continue;
    const factor = zoneWeight(entry.zone, zoneCWeight) * entry.accessFactor * entry.dataQuality * entry.scaleFactor;
    for (const segment of SEGMENTS) {
      const awarded = points[segment];
      if (awarded !== undefined) totals[segment] += awarded * factor;
    }
  }

  for (const segment of SEGMENTS) totals[segment] = Math.min(SEGMENT_CAP, totals[segment]);
  return totals;
}

export function segmentRole(score: number): SegmentRole {
  if (atLeast(score, SEGMENT_ROLE_THRESHOLDS.primary)) return 'primary';
  if (atLeast(score, SEGMENT_ROLE_THRESHOLDS.secondary)) return 'secondary';
  if (atLeast(score, SEGMENT_ROLE_THRESHOLDS.supporting)) return 'supporting';
  return 'insignificant';
}

export function segmentRoles(scores: SegmentScores): Record<Segment, SegmentRole> {
  return {
    student: segmentRole(scores.student),
    office: segmentRole(scores.office),
    resident: segmentRole(scores.resident),
    commuter: segmentRole(scores.commuter),
    health: segmentRole(scores.health),
    general: segmentRole(scores.general),
  };
}
