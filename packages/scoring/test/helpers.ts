import type { Facility, FacilityKind, LocationInput, SiteConditions, WeeklyHours } from '../src/index.js';

export const ORIGIN = { lat: -7.3, lng: 112.72 };

export const AS_OF = '2026-09-01';

/** Three months before AS_OF, so a facility surveyed on this date has Data Quality 1.00. */
export const RECENTLY_SURVEYED = '2026-06-01';

/** Open 08:00–22:00 every day. */
export const ALL_WEEK: WeeklyHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, from: 480, to: 1320 }));

const METERS_PER_DEGREE_LATITUDE = (6_371_008.8 * Math.PI) / 180;

let sequence = 0;

/** A recently surveyed facility due north of ORIGIN, at exactly `meters` along the meridian. */
export function facilityAt(kind: FacilityKind, meters: number, overrides: Partial<Facility> = {}): Facility {
  sequence += 1;
  return {
    id: `test/${sequence}`,
    kind,
    lat: ORIGIN.lat + meters / METERS_PER_DEGREE_LATITUDE,
    lng: ORIGIN.lng,
    checkDate: RECENTLY_SURVEYED,
    ...overrides,
  };
}

export function locationInput(facilities: readonly Facility[], site: SiteConditions = {}): LocationInput {
  return { location: ORIGIN, facilities, site, asOf: AS_OF };
}
