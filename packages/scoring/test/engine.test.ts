// End-to-end behaviour of scoreLocation, recommendBusinessTypes and simulate.

import { describe, expect, it } from 'vitest';
import {
  MODEL_VERSION,
  demandFit,
  locationScore,
  recommendBusinessTypes,
  scoreLocation,
  simulate,
  summarizeScore,
} from '../src/index.js';
import { ALL_WEEK, facilityAt, locationInput } from './helpers.js';

/** A well-mapped, recently surveyed campus neighbourhood. */
const campusArea = () =>
  locationInput(
    [
      facilityAt('campus', 250),
      facilityAt('school', 500),
      facilityAt('school', 500),
      facilityAt('boarding_house', 700, { scale: 'large' }),
      facilityAt('housing', 400),
      facilityAt('housing', 400),
      facilityAt('housing', 400),
      facilityAt('office', 600),
      facilityAt('transit', 350),
      facilityAt('mall', 1200),
      facilityAt('laundry', 900, { openingHours: ALL_WEEK }),
      facilityAt('cafe', 200, { openingHours: ALL_WEEK }),
      facilityAt('atm', 150),
      facilityAt('parking', 120, { capacity: 2 }),
    ],
    { roadClass: 'secondary', pedestrianFeatureCount: 4, nearestWaterwayMeters: 600 },
  );

describe('scoreLocation', () => {
  it('returns a score consistent with its components and confidence', () => {
    const result = scoreLocation(campusArea(), 'laundry');

    expect(result.modelVersion).toBe(MODEL_VERSION);
    expect(result.score.value).toBeCloseTo(locationScore(result.components), 12);
    expect(result.score).toEqual(summarizeScore(result.score.value, result.confidence.value));
    expect(result.components.demandFit).toBeCloseTo(demandFit(result.segments, 'laundry'), 12);
    expect(result.evidence.facilityCount).toBe(14);
    expect(result.insufficientData).toBe(false);
  });

  it('is deterministic and does not modify its input', () => {
    const input = campusArea();
    const snapshot: unknown = JSON.parse(JSON.stringify(input));

    const first = scoreLocation(input, 'food');
    expect(scoreLocation(input, 'food')).toEqual(first);
    expect(input).toEqual(snapshot);
  });

  it('flags insufficient data below a confidence of 40', () => {
    const result = scoreLocation(locationInput([]), 'laundry');
    expect(result.confidence.value).toBeLessThan(40);
    expect(result.insufficientData).toBe(true);
  });

  it('ignores facilities beyond 1,500 m', () => {
    const near = scoreLocation(locationInput([facilityAt('campus', 250)]), 'stationery');
    const withFar = scoreLocation(locationInput([facilityAt('campus', 250), facilityAt('campus', 1600)]), 'stationery');
    expect(withFar.score.value).toBe(near.score.value);
  });
});

describe('simulate', () => {
  it('lets on-site parking raise Accessibility and nothing else', () => {
    const { baseline, simulated, scoreChange } = simulate(campusArea(), 'laundry', { onSiteParkingSpaces: 10 });

    expect(simulated.accessibility.parking).toBeGreaterThan(baseline.accessibility.parking);
    expect(simulated.components.demandFit).toBe(baseline.components.demandFit);
    expect(scoreChange).toBeCloseTo(0.2 * (simulated.components.accessibility - baseline.components.accessibility), 12);
  });
});

describe('recommendBusinessTypes', () => {
  it('ranks categories under the documented list rules', () => {
    const result = recommendBusinessTypes(campusArea());
    const listed = [...result.recommendations, ...result.notRecommended];

    expect(result.insufficientData).toBe(false);
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
    for (const entry of result.recommendations) {
      expect(entry.score.value).toBeGreaterThanOrEqual(60 - 1e-9);
      expect(entry.status).not.toBe('not_recommended');
    }
    for (const entry of result.notRecommended) {
      expect(entry.score.value).toBeLessThan(60);
      expect(entry.status).toBe('not_recommended');
    }

    const values = result.recommendations.map((entry) => entry.score.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(new Set(listed.map((entry) => entry.businessType)).size).toBe(listed.length);
    for (const entry of listed) {
      expect(entry.score).toEqual(scoreLocation(campusArea(), entry.businessType).score);
    }
  });

  it('returns no ranking when confidence is below 40', () => {
    expect(recommendBusinessTypes(locationInput([]))).toMatchObject({
      insufficientData: true,
      recommendations: [],
      notRecommended: [],
      equivalent: [],
    });
  });

  it('marks every viable category needs_validation when confidence is 40–59', () => {
    const editedOnly = { checkDate: undefined, lastEditDate: '2026-07-01' };
    const input = locationInput([
      ...Array.from({ length: 4 }, () => facilityAt('campus', 100, editedOnly)),
      ...Array.from({ length: 6 }, () => facilityAt('boarding_house', 500, editedOnly)),
      ...Array.from({ length: 3 }, () => facilityAt('government_office', 150, editedOnly)),
    ]);
    const result = recommendBusinessTypes(input);

    expect(result.confidence.value).toBeCloseTo(56.25, 9);
    expect(result.recommendations.length).toBeGreaterThan(0);
    for (const entry of result.recommendations) expect(entry.status).toBe('needs_validation');
  });
});
