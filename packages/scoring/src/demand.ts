import { SEGMENT_WEIGHTS, SEGMENTS } from './constants.js';
import type { BusinessType, Segment, SegmentScores } from './types.js';

/** Demand Fit: segment scores weighted by what this category's customers look like. */
export function demandFit(segments: SegmentScores, businessType: BusinessType): number {
  const weights = SEGMENT_WEIGHTS[businessType];
  let total = 0;
  for (const segment of SEGMENTS) total += weights[segment] * segments[segment];
  return total;
}

/** The segment contributing most to this category's Demand Fit. Ties go to the earlier segment. */
export function dominantSegment(segments: SegmentScores, businessType: BusinessType): Segment {
  const weights = SEGMENT_WEIGHTS[businessType];
  let best: Segment = 'student';
  let bestContribution = -1;
  for (const segment of SEGMENTS) {
    const contribution = weights[segment] * segments[segment];
    if (contribution > bestContribution) {
      best = segment;
      bestContribution = contribution;
    }
  }
  return best;
}
