import { ACCESS_FACTOR, DATA_AGE_MONTHS, DATA_QUALITY, FACILITY_SCALE } from './constants.js';
import type { Facility } from './types.js';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 365.2425 / 12;

/** Age of an ISO date in months at `asOf`, or `null` when the date is missing or invalid. */
export function ageInMonths(date: string | undefined, asOf: string): number | null {
  if (date === undefined) return null;
  const then = Date.parse(date);
  const now = Date.parse(asOf);
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  return Math.max(0, (now - then) / MS_PER_DAY / DAYS_PER_MONTH);
}

/**
 * Data Quality factor. A survey date is the strongest evidence; an edit date is
 * weaker, so records relying on it are capped at the "date unknown" band.
 */
export function dataQuality(facility: Facility, asOf: string): number {
  if (facility.closed) return DATA_QUALITY.closed;
  if (facility.doubtfulCategory) return DATA_QUALITY.staleOrDoubtful;

  const surveyAge = ageInMonths(facility.checkDate, asOf);
  if (surveyAge !== null) {
    if (surveyAge <= DATA_AGE_MONTHS.recent) return DATA_QUALITY.recent;
    if (surveyAge <= DATA_AGE_MONTHS.aging) return DATA_QUALITY.aging;
    return DATA_QUALITY.staleOrDoubtful;
  }

  const editAge = ageInMonths(facility.lastEditDate, asOf);
  if (editAge !== null) {
    return editAge <= DATA_AGE_MONTHS.aging ? DATA_QUALITY.undatedComplete : DATA_QUALITY.staleOrDoubtful;
  }

  const named = facility.name !== undefined && facility.name.trim() !== '';
  return named ? DATA_QUALITY.undatedComplete : DATA_QUALITY.staleOrDoubtful;
}

export function accessFactor(facility: Facility): number {
  return ACCESS_FACTOR[facility.severance ?? 'none'];
}

export function scaleFactor(facility: Facility): number {
  return FACILITY_SCALE[facility.scale ?? 'medium'];
}
