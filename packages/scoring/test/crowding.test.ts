// Diminishing returns for facilities of one kind in one zone (PROPOSED in model 0.1.0).

import { describe, expect, it } from 'vitest';
import {
  effectiveCount,
  evaluateFacilities,
  scoreLocation,
  segmentScores,
  type LocationInput,
} from '../src/index.js';
import { facilityAt, locationInput } from './helpers.js';

const counted = (kind: 'cafe' | 'school', zone: 'a' | 'b' | 'c', count: number): LocationInput => ({
  ...locationInput([]),
  facilityCounts: [{ kind, zone, count, source: 'google' }],
});

describe('effectiveCount', () => {
  it('counts the first few in full, then adds less for each one after', () => {
    for (const count of [0, 1, 2, 3]) expect(effectiveCount(count)).toBe(count);
    expect(effectiveCount(4)).toBeCloseTo(3 + 5 * Math.log(1.2), 9);
    expect(effectiveCount(4)).toBeLessThan(4);
  });

  it('never stops rising, so more facilities always count for more', () => {
    for (const count of [5, 20, 100, 500]) expect(effectiveCount(count)).toBeGreaterThan(effectiveCount(count - 1));
    expect(effectiveCount(500)).toBeLessThan(30);
  });
});

describe('crowding', () => {
  it('leaves a handful of facilities of one kind untouched', () => {
    const three = [facilityAt('cafe', 200), facilityAt('cafe', 250), facilityAt('cafe', 280)];
    expect(evaluateFacilities(locationInput(three)).map((entry) => entry.weight)).toEqual([1, 1, 1]);
  });

  it('shares the reduced weight between facilities of one kind in one zone, leaving the count reported as it is', () => {
    const five = Array.from({ length: 5 }, (_, index) => facilityAt('cafe', 200 + index));
    const evaluated = evaluateFacilities(locationInput(five));

    expect(evaluated.reduce((sum, entry) => sum + entry.weight, 0)).toBeCloseTo(effectiveCount(5), 9);
    expect(evaluated.every((entry) => entry.count === 1)).toBe(true);
  });

  it('counts each zone on its own', () => {
    const facilities = [
      ...Array.from({ length: 5 }, () => facilityAt('cafe', 200)),
      ...Array.from({ length: 5 }, () => facilityAt('cafe', 600)),
    ];
    const evaluated = evaluateFacilities(locationInput(facilities));
    const weightIn = (zone: string) =>
      evaluated.filter((entry) => entry.zone === zone).reduce((sum, entry) => sum + entry.weight, 0);

    expect(weightIn('a')).toBeCloseTo(effectiveCount(5), 9);
    expect(weightIn('b')).toBeCloseTo(effectiveCount(5), 9);
  });

  it('treats a counted group exactly like the same number of mapped facilities', () => {
    const [entry] = evaluateFacilities(counted('cafe', 'a', 40));

    expect(entry?.count).toBe(40);
    expect(entry?.weight).toBeCloseTo(effectiveCount(40), 9);
  });

  it('keeps a dense centre from flooding a segment score', () => {
    // 40 schools within 1.5 km: without crowding this alone would cap the Student score at 100.
    expect(segmentScores(evaluateFacilities(counted('school', 'c', 40))).student).toBeLessThan(60);
  });

  it('keeps reporting the real competitor count while weighting the crowd less', () => {
    const result = scoreLocation(counted('cafe', 'a', 500), 'beverages');

    expect(result.competition.rawCount).toBe(500);
    expect(result.competition.equivalentCount).toBeLessThan(20);
    expect(result.competition.reading).toBe('heavily_saturated');
  });
});
