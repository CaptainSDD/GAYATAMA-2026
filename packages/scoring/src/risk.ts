import { DATA_AGE_MONTHS, FLOOD_WARNING_METERS, RISK, STALE_DATA_SHARE } from './constants.js';
import { clamp } from './math.js';
import { ageInMonths } from './quality.js';
import type { EvaluatedFacility, HardWarning, SiteConditions } from './types.js';

// PROPOSED in model 0.1.0 — see "Proposed in model 0.1.0" in docs/methodology.md.
// Every signal here is a proxy from OpenStreetMap, not authoritative risk data.

export function riskAndOperability(site: SiteConditions = {}): number {
  let score: number = RISK.base;
  const waterway = site.nearestWaterwayMeters;
  if (waterway !== undefined) {
    if (waterway <= RISK.waterwayNearMeters) score -= RISK.waterwayNearPenalty;
    else if (waterway <= RISK.waterwayMidMeters) score -= RISK.waterwayMidPenalty;
  }
  if (site.industrialLanduseNearby === true) score -= RISK.industrialPenalty;
  return clamp(score, 0, 100);
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
