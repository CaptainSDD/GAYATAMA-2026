import { describe, expect, it } from 'vitest';
import type { Cell } from './grid';
import { CENTRE_ID, DIRECTIONS, bestCell, cellDistanceMeters, isScored } from './grid';

const cell = (id: string, score: number | null, status: Cell['status'] = 'scored'): Cell => ({
  id,
  lat: -7,
  lng: 110,
  status,
  score,
  confidence: score === null ? null : 70,
});

describe('isScored', () => {
  it('rejects a cell the engine declined to score', () => {
    expect(isScored(cell('0:0', null, 'insufficient_data'))).toBe(false);
    expect(isScored(cell('0:0', null, 'unavailable'))).toBe(false);
  });

  it('accepts a scored cell', () => {
    expect(isScored(cell('0:0', 72))).toBe(true);
  });
});

describe('bestCell', () => {
  it('returns the highest score', () => {
    const best = bestCell([cell('0:0', 70), cell('-1:-1', 79.5), cell('1:0', 73)]);
    expect(best?.id).toBe('-1:-1');
  });

  it('ignores cells without a score, so a blank cell never wins', () => {
    const best = bestCell([cell('0:0', 61), cell('1:1', null, 'insufficient_data')]);
    expect(best?.id).toBe(CENTRE_ID);
  });

  it('is null when nothing could be scored', () => {
    expect(bestCell([cell('0:0', null, 'unavailable'), cell('1:1', null, 'insufficient_data')])).toBeNull();
  });
});

describe('cellDistanceMeters', () => {
  it('is zero at the centre', () => {
    expect(cellDistanceMeters(CENTRE_ID, 350)).toBe(0);
  });

  it('is the spacing for an orthogonal neighbour', () => {
    expect(cellDistanceMeters('1:0', 350)).toBe(350);
    expect(cellDistanceMeters('0:-1', 350)).toBe(350);
  });

  it('is further for a diagonal neighbour than the spacing suggests', () => {
    expect(Math.round(cellDistanceMeters('-1:-1', 350))).toBe(495);
  });
});

describe('DIRECTIONS', () => {
  it('names every cell of the 3 x 3 grid', () => {
    for (const row of [-1, 0, 1]) {
      for (const column of [-1, 0, 1]) {
        expect(DIRECTIONS[`${row}:${column}`]).toBeTypeOf('string');
      }
    }
  });

  it('reads row as north and column as east, matching the API grid', () => {
    expect(DIRECTIONS['1:0']).toBe('utara');
    expect(DIRECTIONS['-1:0']).toBe('selatan');
    expect(DIRECTIONS['0:1']).toBe('timur');
    expect(DIRECTIONS['0:-1']).toBe('barat');
  });
});
