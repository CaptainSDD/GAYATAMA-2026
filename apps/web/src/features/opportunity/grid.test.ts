import { describe, expect, it } from 'vitest';
import type { Cell } from './grid';
import { bestCell, isScored } from './grid';

const cell = (id: string, score: number | null, status: Cell['status'] = 'scored'): Cell => ({
  id,
  label: id,
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
    const best = bestCell([cell('0:0', 70), cell('2:1', 79.5), cell('1:0', 73)]);
    expect(best?.id).toBe('2:1');
  });

  it('ignores cells without a score, so a blank cell never wins', () => {
    const best = bestCell([cell('0:0', 61), cell('1:1', null, 'insufficient_data')]);
    expect(best?.id).toBe('0:0');
  });

  it('is null when nothing could be scored', () => {
    expect(bestCell([cell('0:0', null, 'unavailable'), cell('1:1', null, 'insufficient_data')])).toBeNull();
  });
});
