// compareBusinessTypes: every category compared for one location, and the
// guarantee that adding it left recommendBusinessTypes untouched.

import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TYPES,
  compareBusinessTypes,
  recommendBusinessTypes,
  scoreLocation,
} from '../src/index.js';
import { ALL_WEEK, facilityAt, locationInput } from './helpers.js';

/** A residential neighbourhood with boarding houses: the case laundry is meant to win. */
const residentialArea = () =>
  locationInput(
    [
      facilityAt('housing', 300),
      facilityAt('housing', 350),
      facilityAt('housing', 450),
      facilityAt('boarding_house', 400, { scale: 'large' }),
      facilityAt('boarding_house', 600),
      facilityAt('campus', 700),
      facilityAt('school', 650),
      facilityAt('transit', 320),
      facilityAt('atm', 200),
      facilityAt('parking', 150, { capacity: 4 }),
      facilityAt('cafe', 250, { openingHours: ALL_WEEK }),
      facilityAt('restaurant', 280, { openingHours: ALL_WEEK }),
      facilityAt('fast_food', 300, { openingHours: ALL_WEEK }),
    ],
    { roadClass: 'secondary', pedestrianFeatureCount: 5, nearestWaterwayMeters: 800 },
  );

describe('compareBusinessTypes', () => {
  it('keeps every category, highest score first', () => {
    const result = compareBusinessTypes(residentialArea());

    expect(result.insufficientData).toBe(false);
    expect(result.categories).toHaveLength(BUSINESS_TYPES.length);
    expect([...result.categories].map((entry) => entry.businessType).sort()).toEqual([...BUSINESS_TYPES].sort());

    const scores = result.categories.map((entry) => entry.score.value);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('scores each category exactly as a single-category analysis would', () => {
    const input = residentialArea();
    const compared = compareBusinessTypes(input);

    for (const entry of compared.categories) {
      const single = scoreLocation(input, entry.businessType);
      expect(entry.score).toEqual(single.score);
      expect(entry.components).toEqual(single.components);
      expect(entry.competition.saturationRatio).toBeCloseTo(single.competition.saturationRatio, 12);
    }
  });

  it('agrees with the ranking endpoint on the categories that ranking keeps', () => {
    const input = residentialArea();
    const compared = compareBusinessTypes(input);
    const recommended = recommendBusinessTypes(input);

    // The ranking lists at most three, so comparison is a superset that must not disagree.
    expect(compared.categories.length).toBeGreaterThan(recommended.recommendations.length);
    for (const entry of recommended.recommendations) {
      const match = compared.categories.find((category) => category.businessType === entry.businessType);
      expect(match?.score.value).toBe(entry.score.value);
    }
    expect(compared.categories[0]?.businessType).toBe(recommended.recommendations[0]?.businessType);
  });

  it('reports insufficient data instead of ranking when confidence is below the floor', () => {
    const result = compareBusinessTypes(locationInput([]));

    expect(result.insufficientData).toBe(true);
    expect(result.categories).toEqual([]);
    expect(result.equivalent).toEqual([]);
  });

  it('is deterministic and does not modify its input', () => {
    const input = residentialArea();
    const snapshot: unknown = JSON.parse(JSON.stringify(input));

    expect(compareBusinessTypes(input)).toEqual(compareBusinessTypes(input));
    expect(input).toEqual(snapshot);
  });
});
