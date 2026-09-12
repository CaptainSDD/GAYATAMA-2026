import type { FacilityKind } from '@gayatama/scoring';
import { describe, expect, it } from 'vitest';
import type { PoiFacility, PoiFacilityCount } from './api-types';
import { segmentEvidence } from './evidence';

let nextId = 1;
const facility = (kind: FacilityKind, dataQuality = 1): PoiFacility => ({
  id: `node/${nextId++}`,
  kind,
  lat: -7.31,
  lng: 112.72,
  distanceMeters: 400,
  zone: 'b',
  dataQuality,
  accessFactor: 1,
});

describe('segmentEvidence', () => {
  it('counts the facilities that award points to each segment', () => {
    const evidence = segmentEvidence([
      facility('campus'),
      facility('campus'),
      facility('school'),
      facility('cafe'),
      facility('boarding_house', 0),
    ]);

    expect(evidence.student).toEqual([
      { kind: 'campus', count: 2 },
      { kind: 'school', count: 1 },
    ]);
    expect(evidence.resident).toEqual([{ kind: 'school', count: 1 }]);
    expect(evidence.office).toEqual([{ kind: 'campus', count: 2 }]);
    expect(evidence.health).toEqual([]);
  });

  it('leaves out closed records, which carry no weight', () => {
    expect(segmentEvidence([facility('hospital', 0)]).health).toEqual([]);
  });

  it('adds each counted group by its count', () => {
    const counted = (kind: FacilityKind, count: number): PoiFacilityCount => ({
      kind,
      zone: 'b',
      count,
      scale: 'medium',
      source: 'google',
      dataQuality: 0.65,
    });

    const evidence = segmentEvidence([facility('school')], [counted('school', 3), counted('campus', 2)]);

    expect(evidence.student).toEqual([
      { kind: 'school', count: 4 },
      { kind: 'campus', count: 2 },
    ]);
  });
});
