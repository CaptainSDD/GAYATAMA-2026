import { describe, expect, it } from 'vitest';
import { displayScore, formatDistance, formatPercent, formatRange, formatZone } from './format';

describe('displayScore', () => {
  it('rounds to a whole number when the band is unchanged', () => {
    expect(displayScore(75.15)).toBe('75');
    expect(displayScore(59.4)).toBe('59');
    expect(displayScore(70)).toBe('70');
  });

  it('keeps one decimal when rounding would cross into the next band', () => {
    expect(displayScore(69.5)).toBe('69.5');
    expect(displayScore(69.96)).toBe('69.9');
    expect(displayScore(79.6)).toBe('79.6');
    expect(displayScore(49.99)).toBe('49.9');
  });
});

describe('formatting', () => {
  it('shows the interval exactly as the API computed it', () => {
    expect(formatRange({ value: 75.15, band: 'suitable', confidence: 81, margin: 8, range: [67, 83] })).toBe('67–83');
  });

  it('formats distances in metres, then kilometres', () => {
    expect(formatDistance(250.4)).toBe('250 m');
    expect(formatDistance(999.6)).toBe('1.0 km');
    expect(formatDistance(1500)).toBe('1.5 km');
  });

  it('names a zone with its distance band', () => {
    expect(formatZone('a')).toBe('Zona A, 0 m–300 m');
    expect(formatZone('c')).toBe('Zona C, 800 m–1.5 km');
  });

  it('formats weights as percentages', () => {
    expect(formatPercent(0.35)).toBe('35%');
    expect(formatPercent(0.2)).toBe('20%');
  });
});
