import {
  CONFIDENCE_READINGS,
  CONFIDENCE_WEIGHTS,
  CROSS_SOURCE_VALIDATION_NEUTRAL,
  EXPECTED_FACILITY_GROUPS,
  MARGIN,
} from './constants.js';
import { atLeast, clamp } from './math.js';
import type { ConfidenceReading, ConfidenceResult, EvaluatedFacility, SiteConditions } from './types.js';

const ZONE_COUNT = 3;

/**
 * Confidence = 0.40 × Data Completeness + 0.25 × Data Freshness
 *            + 0.20 × Cross-source Validation + 0.15 × Area Coverage
 *
 * How each input is measured is PROPOSED in model 0.1.0.
 */
export function confidenceScore(evaluated: readonly EvaluatedFacility[], site: SiteConditions = {}): ConfidenceResult {
  const usable = evaluated.filter((entry) => entry.dataQuality > 0);
  const kinds = new Set(usable.map((entry) => entry.facility.kind));

  let groupsPresent = EXPECTED_FACILITY_GROUPS.filter((group) => group.some((kind) => kinds.has(kind))).length;
  if (site.roadClass !== undefined) groupsPresent += 1;
  const completeness = (groupsPresent / (EXPECTED_FACILITY_GROUPS.length + 1)) * 100;

  // Mean Data Quality of open facilities, where a counted entry weighs as many facilities as it stands for.
  const open = evaluated.filter((entry) => !entry.facility.closed);
  const openCount = open.reduce((sum, entry) => sum + entry.count, 0);
  const freshness =
    openCount === 0 ? 0 : (open.reduce((sum, entry) => sum + entry.dataQuality * entry.count, 0) / openCount) * 100;

  const crossSourceValidation = CROSS_SOURCE_VALIDATION_NEUTRAL;
  const areaCoverage = (new Set(usable.map((entry) => entry.zone)).size / ZONE_COUNT) * 100;

  const value =
    CONFIDENCE_WEIGHTS.completeness * completeness +
    CONFIDENCE_WEIGHTS.freshness * freshness +
    CONFIDENCE_WEIGHTS.crossSourceValidation * crossSourceValidation +
    CONFIDENCE_WEIGHTS.areaCoverage * areaCoverage;

  return { value, reading: confidenceReading(value), completeness, freshness, crossSourceValidation, areaCoverage };
}

export function confidenceReading(confidence: number): ConfidenceReading {
  if (atLeast(confidence, CONFIDENCE_READINGS.high)) return 'high';
  if (atLeast(confidence, CONFIDENCE_READINGS.good)) return 'good';
  if (atLeast(confidence, CONFIDENCE_READINGS.moderate)) return 'moderate';
  if (atLeast(confidence, CONFIDENCE_READINGS.low)) return 'low';
  return 'very_low';
}

/** Margin = round(5 + 0.15 × (100 − Confidence)) */
export function uncertaintyMargin(confidence: number): number {
  return Math.round(MARGIN.base + MARGIN.perConfidencePoint * (100 - clamp(confidence, 0, 100)));
}

/** Displayed range: the score ± margin, rounded and clamped to 0–100. */
export function scoreRange(value: number, margin: number): [number, number] {
  return [clamp(Math.round(value - margin), 0, 100), clamp(Math.round(value + margin), 0, 100)];
}
