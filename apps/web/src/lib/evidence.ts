import { SEGMENT_POINTS, SEGMENTS, type FacilityKind, type Segment } from '@gayatama/scoring';
import type { PoiFacility, PoiFacilityCount } from './api-types';

export interface KindCount {
  kind: FacilityKind;
  count: number;
}

/**
 * The facilities behind each segment score, counted by kind, most frequent
 * first. A counted group adds its whole count. Records with a Data Quality of 0
 * (closed businesses) are left out, because the engine gives them no weight.
 */
export function segmentEvidence(
  facilities: readonly PoiFacility[],
  facilityCounts: readonly PoiFacilityCount[] = [],
): Record<Segment, KindCount[]> {
  const counts = new Map<Segment, Map<FacilityKind, number>>(SEGMENTS.map((segment) => [segment, new Map()]));
  const entries = [
    ...facilities.map(({ kind, dataQuality }) => ({ kind, dataQuality, count: 1 })),
    ...facilityCounts.map(({ kind, dataQuality, count }) => ({ kind, dataQuality, count })),
  ];

  for (const entry of entries) {
    if (entry.dataQuality <= 0 || entry.count <= 0) continue;
    const points = SEGMENT_POINTS[entry.kind];
    if (points === undefined) continue;
    for (const segment of SEGMENTS) {
      if ((points[segment] ?? 0) <= 0) continue;
      const kinds = counts.get(segment);
      kinds?.set(entry.kind, (kinds.get(entry.kind) ?? 0) + entry.count);
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
