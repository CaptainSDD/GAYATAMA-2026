import { DATA_AGE_MONTHS, FLOOD_WARNING_METERS, NEUTRAL_SCORE, RISK, STALE_DATA_SHARE } from './constants.js';
import { clamp } from './math.js';
import { ageInMonths } from './quality.js';
import type { EvaluatedFacility, HardWarning, SiteConditions } from './types.js';

// PROPOSED in model 0.1.0 — see "Proposed in model 0.1.0" in docs/methodology.md.
// Every signal here is a proxy from OpenStreetMap, not authoritative risk data.

export function riskAndOperability(site: SiteConditions = {}, available = true): number {
  // No warning signal found is not the same as failing to load the signals.
  // A failed lookup is neutral so missing data can neither reward nor punish a location.
  if (!available) return NEUTRAL_SCORE;
  let score: number = RISK.base;
  const waterway = site.nearestWaterwayMeters;
  if (waterway !== undefined) {
    if (waterway <= RISK.waterwayNearMeters) score -= RISK.waterwayNearPenalty;
    else if (waterway <= RISK.waterwayMidMeters) score -= RISK.waterwayMidPenalty;
  }
  if (site.industrialLanduseNearby === true) score -= RISK.industrialPenalty;
  score -= surroundingPenalty(site);
  return clamp(score, 0, 100);
}

/**
 * PROPOSED: what nearby cemeteries, waste sites, quarries, military land and
 * prisons take off, capped so a single awkward corner cannot zero the component.
 * The map says what is there, not how much custom it costs — so this is a
 * flag with a modest weight, and the warning beside it carries the real message.
 */
export function surroundingPenalty(site: SiteConditions = {}): number {
  const total = (site.discouragingSurroundings ?? []).reduce((sum, kind) => sum + RISK.surroundingPenalty[kind], 0);
  return Math.min(total, RISK.maxSurroundingPenalty);
}

/** Warnings surfaced regardless of how high the score is. */
export function hardWarnings(
  evaluated: readonly EvaluatedFacility[],
  site: SiteConditions = {},
  asOf: string,
): HardWarning[] {
  const warnings: HardWarning[] = [];

  if (site.nearestWaterwayMeters !== undefined && site.nearestWaterwayMeters <= FLOOD_WARNING_METERS) {
    warnings.push({ code: 'flood_risk_proxy' });
  }

  const surroundings = site.discouragingSurroundings ?? [];
  if (surroundings.length > 0) warnings.push({ code: 'unsuitable_surroundings', surroundings: [...surroundings] });

  let dated = 0;
  let stale = 0;
  for (const entry of evaluated) {
    if (entry.facility.closed) continue;
    const age = ageInMonths(entry.facility.checkDate ?? entry.facility.lastEditDate, asOf);
    if (age === null) continue;
    dated += 1;
    if (age > DATA_AGE_MONTHS.staleWarning) stale += 1;
  }
  if (dated > 0 && stale / dated > STALE_DATA_SHARE) warnings.push({ code: 'stale_data' });

  return warnings;
}
