import {
  COMPETITION_SCORE,
  COMPETITOR_RADIUS_METERS,
  DEMAND_PER_COMPETITOR,
  DENSITY_BANDS,
  SATURATION_THRESHOLDS,
  SECONDARY_COMPETITOR_WEIGHT_CAP,
  SIMILARITY,
  SIMILARITY_LEVEL,
  VALIDATION_BONUS,
} from './constants.js';
import { operatingHoursFactor } from './hours.js';
import { atLeast, atMost, clamp } from './math.js';
import type {
  BusinessType,
  CompetitionResult,
  CompetitorContribution,
  Density,
  EvaluatedFacility,
  Facility,
  SaturationReading,
  WeeklyHours,
} from './types.js';

export function similarity(businessType: BusinessType, facility: Facility): number {
  const level = SIMILARITY[businessType][facility.kind];
  if (level !== undefined) return level;
  const servesCoffee = facility.servesCoffee === true && (facility.kind === 'restaurant' || facility.kind === 'fast_food');
  return businessType === 'beverages' && servesCoffee ? SIMILARITY_LEVEL.indirect : SIMILARITY_LEVEL.none;
}

/**
 * K = Σ Distance Weight × Access Factor × Data Quality × Operating-Hours Factor
 *       × Similarity × Competitor Scale
 *
 * A counted entry contributes once per competitor it stands for.
 */
export function competitorContributions(
  evaluated: readonly EvaluatedFacility[],
  businessType: BusinessType,
  targetHours?: WeeklyHours,
): CompetitorContribution[] {
  const radius = COMPETITOR_RADIUS_METERS[businessType];
  const contributions: CompetitorContribution[] = [];

  for (const entry of evaluated) {
    const level = similarity(businessType, entry.facility);
    if (level === 0) continue;
    const hours = operatingHoursFactor(targetHours, entry.facility.openingHours);
    const weight =
      entry.distanceMeters <= radius
        ? entry.distanceWeight
        : Math.min(entry.distanceWeight, SECONDARY_COMPETITOR_WEIGHT_CAP);
    const contribution: CompetitorContribution = {
      facility: entry.facility,
      distanceMeters: entry.distanceMeters,
      zone: entry.zone,
      similarity: level,
      operatingHoursFactor: hours,
      count: entry.count,
      contribution: weight * entry.accessFactor * entry.dataQuality * hours * level * entry.scaleFactor * entry.count,
    };
    if (entry.countedFrom !== undefined) contribution.countedFrom = entry.countedFrom;
    contributions.push(contribution);
  }

  return contributions.sort((a, b) => b.contribution - a.contribution || a.distanceMeters - b.distanceMeters);
}

export function densityBand(equivalentCount: number, radiusMeters: 800 | 1500): Density {
  const bands = DENSITY_BANDS[radiusMeters];
  if (atLeast(equivalentCount, bands.veryHigh)) return 'very_high';
  if (atLeast(equivalentCount, bands.high)) return 'high';
  if (atLeast(equivalentCount, bands.moderate)) return 'moderate';
  return 'low';
}

/** Saturation Ratio = K / max(1, Demand Fit / T) */
export function saturationRatio(equivalentCount: number, demandFitValue: number, businessType: BusinessType): number {
  const capacity = Math.max(1, demandFitValue / DEMAND_PER_COMPETITOR[businessType]);
  return equivalentCount / capacity;
}

export function saturationReading(ratio: number): SaturationReading {
  if (atLeast(ratio, SATURATION_THRESHOLDS.heavilySaturated)) return 'heavily_saturated';
  if (atLeast(ratio, SATURATION_THRESHOLDS.saturated)) return 'saturated';
  if (atLeast(ratio, SATURATION_THRESHOLDS.becomingSaturated)) return 'becoming_saturated';
  if (atLeast(ratio, SATURATION_THRESHOLDS.healthy)) return 'healthy';
  return 'not_saturated';
}

/** Zero competitors is a penalty: an empty market is more often unvalidated than untapped. */
export function validationBonus(equivalentCount: number): number {
  if (equivalentCount <= 0) return VALIDATION_BONUS.noCompetitors;
  if (atMost(equivalentCount, 2)) return VALIDATION_BONUS.upToTwo;
  if (atMost(equivalentCount, 5)) return VALIDATION_BONUS.upToFive;
  return VALIDATION_BONUS.moreThanFive;
}

/** Competition Score = clamp(95 − 35 × Saturation Ratio + Validation Bonus, 0, 100) */
export function competitionScore(equivalentCount: number, ratio: number): number {
  return clamp(
    COMPETITION_SCORE.base - COMPETITION_SCORE.perSaturation * ratio + validationBonus(equivalentCount),
    0,
    100,
  );
}

export function analyzeCompetition(
  evaluated: readonly EvaluatedFacility[],
  businessType: BusinessType,
  demandFitValue: number,
  targetHours?: WeeklyHours,
): CompetitionResult {
  const radiusMeters = COMPETITOR_RADIUS_METERS[businessType];
  const competitors = competitorContributions(evaluated, businessType, targetHours);
  const equivalentCount = competitors.reduce((sum, c) => sum + c.contribution, 0);
  let rawCount = 0;
  for (const entry of evaluated) {
    if (entry.distanceMeters <= radiusMeters && entry.dataQuality > 0 && similarity(businessType, entry.facility) > 0) {
      rawCount += entry.count;
    }
  }
  const ratio = saturationRatio(equivalentCount, demandFitValue, businessType);

  return {
    radiusMeters,
    rawCount,
    equivalentCount,
    density: densityBand(equivalentCount, radiusMeters),
    saturationRatio: ratio,
    reading: saturationReading(ratio),
    validationBonus: validationBonus(equivalentCount),
    score: competitionScore(equivalentCount, ratio),
    competitors,
  };
}
