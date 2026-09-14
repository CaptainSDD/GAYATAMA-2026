// PROPOSED: neighbours that keep customers away — see docs/methodology.md.

import { describe, expect, it } from 'vitest';
import { RISK, hardWarnings, riskAndOperability, surroundingPenalty } from '../src/index.js';
import { AS_OF } from './helpers.js';

const ALL = ['cemetery', 'waste', 'quarry', 'military', 'prison'] as const;

describe('unsuitable surroundings', () => {
  it('takes something off for each kind of discouraging neighbour', () => {
    expect(riskAndOperability({})).toBe(100);
    expect(riskAndOperability({ discouragingSurroundings: ['cemetery'] })).toBe(90);
    expect(riskAndOperability({ discouragingSurroundings: ['waste'] })).toBe(80);
    expect(riskAndOperability({ discouragingSurroundings: ['cemetery', 'quarry'] })).toBe(75);
  });

  it('caps what they take off together, so one awkward corner cannot zero the component', () => {
    expect(surroundingPenalty({ discouragingSurroundings: [...ALL] })).toBe(RISK.maxSurroundingPenalty);
    expect(riskAndOperability({ discouragingSurroundings: [...ALL] })).toBe(100 - RISK.maxSurroundingPenalty);
  });

  it('counts alongside the waterway and industrial penalties', () => {
    const site = { nearestWaterwayMeters: 80, industrialLanduseNearby: true, discouragingSurroundings: ['cemetery'] } as const;
    expect(riskAndOperability(site)).toBe(100 - 20 - 15 - 10);
  });

  it('raises a warning that names what was found', () => {
    expect(hardWarnings([], { discouragingSurroundings: ['cemetery', 'waste'] }, AS_OF)).toEqual([
      { code: 'unsuitable_surroundings', surroundings: ['cemetery', 'waste'] },
    ]);
    expect(hardWarnings([], {}, AS_OF)).toEqual([]);
  });
});
