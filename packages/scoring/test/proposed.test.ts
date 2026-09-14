// Formulas and input rules PROPOSED in model 0.1.0, pending team review.
// See "Proposed in model 0.1.0" in docs/methodology.md.

import { describe, expect, it } from 'vitest';
import {
  accessibility,
  confidenceScore,
  dataQuality,
  evaluateFacilities,
  hardWarnings,
  operatingHoursFactor,
  overlapMinutes,
  parkingScore,
  riskAndOperability,
  roadScore,
  supportingFacilityFit,
  transitScore,
  walkabilityScore,
  weeklyMinutes,
  type Facility,
} from '../src/index.js';
import { AS_OF, ORIGIN, facilityAt, locationInput } from './helpers.js';

describe('Accessibility', () => {
  it('scores road class, neutral when unknown', () => {
    expect(roadScore('primary')).toBe(100);
    expect(roadScore('residential')).toBe(55);
    expect(roadScore(undefined)).toBe(50);
  });

  it('scores transit by the nearest stop', () => {
    const evaluated = evaluateFacilities(locationInput([facilityAt('transit', 600), facilityAt('transit', 1100)]));
    expect(transitScore(evaluated)).toBeCloseTo(60, 9);
    expect(transitScore([])).toBe(0);
  });

  it('keeps walkability neutral until pedestrian features are counted', () => {
    expect(walkabilityScore(undefined)).toBe(50);
    expect(walkabilityScore(0)).toBe(50);
    expect(walkabilityScore(3)).toBe(80);
    expect(walkabilityScore(9)).toBe(100);
  });

  it('counts parking spaces within 300 m, defaulting unknown capacity to 10', () => {
    const evaluated = evaluateFacilities(
      locationInput([
        facilityAt('parking', 200, { capacity: 4 }),
        facilityAt('parking', 100),
        facilityAt('parking', 450, { capacity: 50 }),
      ]),
    );
    expect(parkingScore(evaluated)).toBeCloseTo(90, 9); // 20 + 5 × (4 + 10)
  });

  it('combines road, transit, walkability and parking 35 / 25 / 20 / 20', () => {
    const result = accessibility([], { roadClass: 'tertiary', pedestrianFeatureCount: 2 }, 10);
    expect(result).toMatchObject({ road: 75, transit: 0, walkability: 70, parking: 70 });
    expect(result.value).toBeCloseTo(0.35 * 75 + 0.2 * 70 + 0.2 * 70, 12);
  });
});

describe('Supporting Facility Fit', () => {
  it('weights supporting facilities per category', () => {
    const evaluated = evaluateFacilities(locationInput([facilityAt('clinic', 100), facilityAt('atm', 500)]));
    expect(supportingFacilityFit(evaluated, 'pharmacy')).toBeCloseTo(30 + 10 * 0.6, 9);
    expect(supportingFacilityFit(evaluated, 'laundry')).toBeCloseTo(6, 9);
  });

  it('does not count a retail anchor as support for a minimarket, its competitor', () => {
    const evaluated = evaluateFacilities(locationInput([facilityAt('convenience', 100)]));
    expect(supportingFacilityFit(evaluated, 'minimarket')).toBe(0);
    expect(supportingFacilityFit(evaluated, 'salon')).toBe(12);
  });
});

describe('Risk and Operability', () => {
  it('starts at 100 and subtracts proxy penalties', () => {
    expect(riskAndOperability({})).toBe(100);
    expect(riskAndOperability({}, false)).toBe(50);
    expect(riskAndOperability({ nearestWaterwayMeters: 80 })).toBe(80);
    expect(riskAndOperability({ nearestWaterwayMeters: 250 })).toBe(90);
    expect(riskAndOperability({ nearestWaterwayMeters: 400 })).toBe(100);
    expect(riskAndOperability({ nearestWaterwayMeters: 30, industrialLanduseNearby: true })).toBe(65);
  });

  it('raises the flood warning for a waterway within 50 m', () => {
    const evaluated = evaluateFacilities(locationInput([facilityAt('school', 100)]));
    expect(hardWarnings(evaluated, { nearestWaterwayMeters: 40 }, AS_OF)).toEqual([{ code: 'flood_risk_proxy' }]);
    expect(hardWarnings(evaluated, { nearestWaterwayMeters: 60 }, AS_OF)).toEqual([]);
  });

  it('raises the stale-data warning when most dated records are over 36 months old', () => {
    const evaluated = evaluateFacilities(
      locationInput([
        facilityAt('school', 100, { checkDate: undefined, lastEditDate: '2022-01-01' }),
        facilityAt('office', 200, { checkDate: '2021-06-01' }),
        facilityAt('housing', 350, { checkDate: '2026-01-01' }),
      ]),
    );
    expect(hardWarnings(evaluated, {}, AS_OF)).toEqual([{ code: 'stale_data' }]);
  });
});

describe('Data Quality derivation', () => {
  const quality = (overrides: Partial<Facility>): number =>
    dataQuality(facilityAt('school', 100, { checkDate: undefined, ...overrides }), AS_OF);

  it('caps records dated only by their last edit at 0.65', () => {
    expect(quality({ lastEditDate: '2026-08-01' })).toBe(0.65);
    expect(quality({ lastEditDate: '2023-01-01' })).toBe(0.4);
  });

  it('treats an undated record as complete only when it has a name', () => {
    expect(quality({ name: 'SMPN 12 Surabaya' })).toBe(0.65);
    expect(quality({})).toBe(0.4);
    expect(quality({ name: '   ' })).toBe(0.4);
  });

  it('prefers the survey date over the edit date', () => {
    expect(quality({ checkDate: '2026-05-01', lastEditDate: '2020-01-01' })).toBe(1);
  });

  it('rejects an invalid asOf date', () => {
    expect(() => evaluateFacilities({ location: ORIGIN, facilities: [], asOf: 'yesterday' })).toThrow(RangeError);
  });
});

describe('Confidence Score inputs', () => {
  it('scores a fully mapped, recently surveyed area at 90', () => {
    const facilities = [
      facilityAt('campus', 100),
      facilityAt('office', 500),
      facilityAt('housing', 1000),
      facilityAt('transit', 200),
      facilityAt('cafe', 600),
    ];
    const result = confidenceScore(evaluateFacilities(locationInput(facilities)), { roadClass: 'tertiary' });

    expect(result).toMatchObject({
      completeness: 100,
      freshness: 100,
      crossSourceValidation: 50,
      areaCoverage: 100,
      reading: 'high',
    });
    expect(result.value).toBeCloseTo(90, 9);
  });

  it('places an empty area below the confidence floor', () => {
    const result = confidenceScore([], {});
    expect(result.value).toBeCloseTo(10, 9);
    expect(result.reading).toBe('very_low');
  });

  it('does not count closed facilities as evidence', () => {
    const evaluated = evaluateFacilities(locationInput([facilityAt('school', 100, { closed: true })]));
    expect(confidenceScore(evaluated, {})).toMatchObject({ completeness: 0, freshness: 0, areaCoverage: 0 });
  });
});

describe('Opening hours', () => {
  it('merges overlapping intervals and ignores invalid days', () => {
    expect(
      weeklyMinutes([
        { day: 0, from: 480, to: 720 },
        { day: 0, from: 600, to: 900 },
        { day: 7, from: 0, to: 600 },
      ]),
    ).toBe(420);
    expect(
      overlapMinutes(
        [{ day: 1, from: 0, to: 1440 }],
        [
          { day: 1, from: 600, to: 660 },
          { day: 2, from: 0, to: 1440 },
        ],
      ),
    ).toBe(60);
  });

  it('treats competitors with known hours as fully overlapping when the business hours are unset', () => {
    expect(operatingHoursFactor(undefined, [])).toBe(1);
  });
});
