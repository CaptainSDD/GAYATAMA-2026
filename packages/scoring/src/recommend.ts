import { confidenceScore } from './confidence.js';
import { BUSINESS_TYPES, CONFIDENCE_FLOOR, MODEL_VERSION, RECOMMENDATION } from './constants.js';
import { evaluateFacilities } from './evaluate.js';
import { scoreEvaluated } from './location-score.js';
import { atLeast, atMost } from './math.js';
import { hardWarnings } from './risk.js';
import { segmentScores } from './segments.js';
import type {
  BusinessType,
  LocationInput,
  RankedCategory,
  RecommendationResult,
  RecommendationStatus,
} from './types.js';

/**
 * Status from a category's unrounded score and the location's confidence.
 * Returns `null` below the confidence floor, where no ranking may be given.
 */
export function recommendationStatus(score: number, confidence: number): RecommendationStatus | null {
  if (confidence < CONFIDENCE_FLOOR) return null;
  if (!atLeast(score, RECOMMENDATION.viableScore)) return 'not_recommended';
  if (!atLeast(confidence, RECOMMENDATION.minConfidence)) return 'needs_validation';
  return atLeast(score, RECOMMENDATION.primaryScore) ? 'primary' : 'alternative';
}

/**
 * Groups adjacent entries of a ranking whose scores are within 3 points of the
 * next entry. Groups chain: A–B and B–C each within 3 points make one group.
 */
export function groupEquivalent(
  ranked: readonly { businessType: BusinessType; score: { value: number } }[],
): BusinessType[][] {
  const groups: BusinessType[][] = [];
  let current: BusinessType[] = [];
  let previous: (typeof ranked)[number] | undefined;

  for (const entry of ranked) {
    if (previous !== undefined && atMost(previous.score.value - entry.score.value, RECOMMENDATION.equivalenceGap)) {
      if (current.length === 0) current.push(previous.businessType);
      current.push(entry.businessType);
    } else {
      if (current.length > 1) groups.push(current);
      current = [];
    }
    previous = entry;
  }
  if (current.length > 1) groups.push(current);
  return groups;
}

/** Scores all seven categories for one location and ranks them. */
export function recommendBusinessTypes(input: LocationInput): RecommendationResult {
  const evaluated = evaluateFacilities(input);
  const confidence = confidenceScore(evaluated, input.site);
  const base = {
    modelVersion: MODEL_VERSION,
    confidence,
    segments: segmentScores(evaluated),
    warnings: hardWarnings(evaluated, input.site, input.asOf),
  };

  if (confidence.value < CONFIDENCE_FLOOR) {
    return { ...base, insufficientData: true, recommendations: [], notRecommended: [], equivalent: [] };
  }

  const ranked: RankedCategory[] = [];
  for (const businessType of BUSINESS_TYPES) {
    const result = scoreEvaluated(input, evaluated, confidence, businessType);
    const status = recommendationStatus(result.score.value, confidence.value);
    if (status === null) continue;
    ranked.push({
      businessType,
      score: result.score,
      status,
      dominantSegment: result.dominantSegment,
      components: result.components,
      saturationRatio: result.competition.saturationRatio,
      saturationReading: result.competition.reading,
    });
  }
  // Array.prototype.sort is stable, so equal scores keep BUSINESS_TYPES order.
  ranked.sort((a, b) => b.score.value - a.score.value);

  const recommendations = ranked
    .filter((entry) => entry.status !== 'not_recommended')
    .slice(0, RECOMMENDATION.maxListed);

  return {
    ...base,
    insufficientData: false,
    recommendations,
    notRecommended: ranked.filter((entry) => entry.status === 'not_recommended'),
    equivalent: groupEquivalent(recommendations),
  };
}
