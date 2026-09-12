import { accessibility } from './accessibility.js';
import { analyzeCompetition } from './competition.js';
import { confidenceScore, scoreRange, uncertaintyMargin } from './confidence.js';
import {
  BAND_THRESHOLDS,
  COMPONENT_KEYS,
  COMPONENT_WEIGHTS,
  CONFIDENCE_FLOOR,
  DELIVERY,
  MODEL_VERSION,
  REPORTED_FACTORS,
  STRENGTH_THRESHOLD,
} from './constants.js';
import { demandFit, dominantSegment } from './demand.js';
import { evaluateFacilities } from './evaluate.js';
import { atLeast } from './math.js';
import { hardWarnings, riskAndOperability } from './risk.js';
import { segmentRoles, segmentScores } from './segments.js';
import { supportingFacilityFit } from './supporting.js';
import type {
  Band,
  BusinessType,
  ComponentFactor,
  Components,
  ConfidenceResult,
  EvaluatedFacility,
  LocationInput,
  LocationScoreResult,
  OperatorOptions,
  ScoreSummary,
} from './types.js';

/** Location Score = 0.35 Demand + 0.20 Accessibility + 0.20 Competition + 0.15 Supporting + 0.10 Risk */
export function locationScore(components: Components): number {
  let total = 0;
  for (const key of COMPONENT_KEYS) total += COMPONENT_WEIGHTS[key] * components[key];
  return total;
}

export function band(score: number): Band {
  if (atLeast(score, BAND_THRESHOLDS.highlySuitable)) return 'highly_suitable';
  if (atLeast(score, BAND_THRESHOLDS.suitable)) return 'suitable';
  if (atLeast(score, BAND_THRESHOLDS.moderatelySuitable)) return 'moderately_suitable';
  if (atLeast(score, BAND_THRESHOLDS.risky)) return 'risky';
  return 'not_recommended';
}

export function summarizeScore(value: number, confidence: number): ScoreSummary {
  const margin = uncertaintyMargin(confidence);
  return { value, band: band(value), confidence, margin, range: scoreRange(value, margin) };
}

/** PROPOSED: the strongest components at or above 60, and the weakest below it. */
export function rankFactors(components: Components): { strengths: ComponentFactor[]; weaknesses: ComponentFactor[] } {
  const factors = COMPONENT_KEYS.map((component) => ({ component, value: components[component] }));
  return {
    strengths: factors
      .filter((f) => atLeast(f.value, STRENGTH_THRESHOLD))
      .sort((a, b) => b.value - a.value)
      .slice(0, REPORTED_FACTORS),
    weaknesses: factors
      .filter((f) => !atLeast(f.value, STRENGTH_THRESHOLD))
      .sort((a, b) => a.value - b.value)
      .slice(0, REPORTED_FACTORS),
  };
}

function computeComponents(
  input: LocationInput,
  evaluated: readonly EvaluatedFacility[],
  businessType: BusinessType,
  options: OperatorOptions,
  zoneCWeight?: number,
) {
  const segments = segmentScores(evaluated, zoneCWeight);
  const demand = demandFit(segments, businessType);
  const competition = analyzeCompetition(evaluated, businessType, demand, options.openingHours);
  const access = accessibility(evaluated, input.site, options.onSiteParkingSpaces);
  const components: Components = {
    demandFit: demand,
    accessibility: access.value,
    competition: competition.score,
    supportingFacility: supportingFacilityFit(evaluated, businessType),
    risk: riskAndOperability(input.site),
  };
  return { segments, competition, access, components };
}

/**
 * Scores one location for one category from facilities that are already
 * evaluated. `recommendBusinessTypes` uses this to evaluate facilities once for
 * all seven categories.
 */
export function scoreEvaluated(
  input: LocationInput,
  evaluated: readonly EvaluatedFacility[],
  confidence: ConfidenceResult,
  businessType: BusinessType,
  options: OperatorOptions = {},
): LocationScoreResult {
  let computed = computeComponents(input, evaluated, businessType, options);
  let value = locationScore(computed.components);
  let delivery: LocationScoreResult['delivery'];

  if (options.delivery === true && DELIVERY.businessTypes.includes(businessType)) {
    const withDelivery = computeComponents(input, evaluated, businessType, options, DELIVERY.zoneCWeight);
    const uncappedScore = locationScore(withDelivery.components);
    const ceiling = value + DELIVERY.maxScoreGain;
    delivery = { uncappedScore, capApplied: uncappedScore > ceiling };
    computed = withDelivery;
    value = Math.min(uncappedScore, ceiling);
  }

  const { segments, competition, access, components } = computed;
  const zones = { a: 0, b: 0, c: 0 };
  let facilityCount = 0;
  for (const entry of evaluated) {
    if (entry.facility.closed) continue;
    zones[entry.zone] += entry.count;
    facilityCount += entry.count;
  }

  const result: LocationScoreResult = {
    modelVersion: MODEL_VERSION,
    businessType,
    score: summarizeScore(value, confidence.value),
    components,
    accessibility: access,
    segments,
    segmentRoles: segmentRoles(segments),
    dominantSegment: dominantSegment(segments, businessType),
    competition,
    confidence,
    ...rankFactors(components),
    warnings: hardWarnings(evaluated, input.site, input.asOf),
    insufficientData: confidence.value < CONFIDENCE_FLOOR,
    evidence: { facilityCount, zones },
  };
  if (delivery !== undefined) result.delivery = delivery;
  return result;
}

/** Full analysis of one location for one business category. */
export function scoreLocation(
  input: LocationInput,
  businessType: BusinessType,
  options: OperatorOptions = {},
): LocationScoreResult {
  const evaluated = evaluateFacilities(input);
  return scoreEvaluated(input, evaluated, confidenceScore(evaluated, input.site), businessType, options);
}
