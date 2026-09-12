// Counted facilities (FacilityCount) must score exactly like the same number of
// mapped facilities in the same zone with the same Data Quality and unknown hours.

import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TYPES,
  COUNTED_DATA_QUALITY,
  ZONE_LIMITS_METERS,
  evaluateFacilities,
  recommendBusinessTypes,
  scoreLocation,
  type Facility,
  type FacilityCount,
  type FacilityKind,
  type LocationInput,
  type Zone,
} from '../src/index.js';
import { facilityAt, locationInput } from './helpers.js';

/** Named but undated, hours unknown: Data Quality 0.65, hours factor 0.80, ignored by the stale-data warning. */
function undated(kind: FacilityKind, meters: number): Facility {
  const { checkDate, ...facility } = facilityAt(kind, meters, { name: 'Mapped' });
  return facility;
}

/** Just inside each zone's outer edge, so the zone is certain despite floating-point distances. */
const INSIDE_EDGE: Record<Zone, number> = { a: 299.9, b: 799.9, c: 1499.9 };

const COUNTS: [FacilityKind, Zone, number][] = [
  ['cafe', 'a', 3],
  ['bubble_tea', 'b', 2],
  ['restaurant', 'b', 5],
  ['laundry', 'c', 4],
  ['convenience', 'a', 1],
  ['supermarket', 'c', 2],
  ['school', 'b', 2],
  ['campus', 'c', 1],
  ['hospital', 'c', 1],
  ['transit', 'b', 2],
  ['atm', 'a', 2],
  ['marketplace', 'b', 1],
];

function inputs(): { counted: LocationInput; mapped: LocationInput } {
  const shared = [facilityAt('housing', 400), facilityAt('housing', 900), facilityAt('copyshop', 250)];
  const counts: FacilityCount[] = COUNTS.map(([kind, zone, count]) => ({ kind, zone, count, source: 'test' }));
  const individuals = COUNTS.flatMap(([kind, zone, count]) =>
    Array.from({ length: count }, () => undated(kind, INSIDE_EDGE[zone])),
  );
  return {
    counted: { ...locationInput(shared, { roadClass: 'tertiary' }), facilityCounts: counts },
    mapped: locationInput([...shared, ...individuals], { roadClass: 'tertiary' }),
  };
}

describe('counted facilities', () => {
  it('score every category exactly like the same facilities mapped individually', () => {
    const { counted, mapped } = inputs();

    for (const businessType of BUSINESS_TYPES) {
      const a = scoreLocation(counted, businessType);
      const b = scoreLocation(mapped, businessType);

      expect(a.score.value).toBeCloseTo(b.score.value, 9);
      for (const key of Object.keys(b.components) as (keyof typeof b.components)[]) {
        expect(a.components[key]).toBeCloseTo(b.components[key], 9);
      }
      for (const segment of Object.keys(b.segments) as (keyof typeof b.segments)[]) {
        expect(a.segments[segment]).toBeCloseTo(b.segments[segment], 9);
      }
      expect(a.competition.rawCount).toBe(b.competition.rawCount);
      expect(a.competition.equivalentCount).toBeCloseTo(b.competition.equivalentCount, 9);
      expect(a.accessibility.transit).toBe(b.accessibility.transit);
      expect(a.confidence.value).toBeCloseTo(b.confidence.value, 9);
      expect(a.evidence).toEqual(b.evidence);
    }
  });

  it('rank categories exactly like the same facilities mapped individually', () => {
    const { counted, mapped } = inputs();
    const summary = (input: LocationInput) =>
      recommendBusinessTypes(input).recommendations.map((entry) => [entry.businessType, entry.status]);
    expect(summary(counted)).toEqual(summary(mapped));
  });

  it('become one entry per kind and zone, at the outer edge of the zone', () => {
    const input: LocationInput = {
      ...locationInput([]),
      facilityCounts: [
        { kind: 'cafe', zone: 'b', count: 4, source: 'google' },
        { kind: 'hospital', zone: 'c', count: 1, scale: 'large', source: 'google' },
        { kind: 'bank', zone: 'a', count: 0, source: 'google' },
      ],
    };

    const evaluated = evaluateFacilities(input);

    expect(evaluated).toHaveLength(2);
    expect(evaluated[0]).toMatchObject({
      facility: { id: 'google:cafe:b', kind: 'cafe' },
      zone: 'b',
      distanceMeters: ZONE_LIMITS_METERS.b,
      distanceWeight: 0.6,
      accessFactor: 1,
      dataQuality: COUNTED_DATA_QUALITY,
      scaleFactor: 1,
      count: 4,
      countedFrom: 'google',
    });
    expect(evaluated[1]).toMatchObject({ facility: { id: 'google:hospital:c:large' }, scaleFactor: 1.4, count: 1 });
  });

  it('report counted competitors with their count and source', () => {
    const result = scoreLocation(
      { ...locationInput([]), facilityCounts: [{ kind: 'cafe', zone: 'c', count: 3, source: 'google' }] },
      'beverages',
    );
    const [competitor] = result.competition.competitors;

    // Zone C is beyond the 800 m primary radius for beverages: counted in K, not in the raw count.
    expect(result.competition.rawCount).toBe(0);
    expect(competitor).toMatchObject({ count: 3, countedFrom: 'google', zone: 'c', operatingHoursFactor: 0.8 });
    expect(competitor?.contribution).toBeCloseTo(0.25 * COUNTED_DATA_QUALITY * 0.8 * 3, 12);
  });
});
