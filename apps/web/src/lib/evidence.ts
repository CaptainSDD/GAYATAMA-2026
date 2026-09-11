import { SEGMENT_POINTS, SEGMENTS, type FacilityKind, type Segment } from '@gayatama/scoring';
import type { PoiFacility } from './api-types';

export interface KindCount {
  kind: FacilityKind;
  count: number;
}

/**
 * The mapped facilities behind each segment score, counted by kind, most
 * frequent first. Records with a Data Quality of 0 (closed businesses) are left
 * out, because the engine gives them no weight.
 */
export function segmentEvidence(facilities: readonly PoiFacility[]): Record<Segment, KindCount[]> {
  const counts = new Map<Segment, Map<FacilityKind, number>>(SEGMENTS.map((segment) => [segment, new Map()]));

  for (const facility of facilities) {
    if (facility.dataQuality <= 0) continue;
    const points = SEGMENT_POINTS[facility.kind];
    if (points === undefined) continue;
    for (const segment of SEGMENTS) {
      if ((points[segment] ?? 0) <= 0) continue;
      const kinds = counts.get(segment);
      kinds?.set(facility.kind, (kinds.get(facility.kind) ?? 0) + 1);
    }
  }

  const result = {} as Record<Segment, KindCount[]>;
  for (const segment of SEGMENTS) {
    result[segment] = [...(counts.get(segment) ?? [])]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
  }
  return result;
}
