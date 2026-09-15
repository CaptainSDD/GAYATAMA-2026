// The example responses in docs/api.md, recomputed from the engine.

import { describe, expect, it } from 'vitest';
import {
  competitionScore,
  densityBand,
  groupEquivalent,
  locationScore,
  recommendationStatus,
  saturationRatio,
  saturationReading,
  segmentRole,
  summarizeScore,
  validationBonus,
} from '../src/index.js';

describe('docs/api.md — POST /api/v1/analysis example', () => {
  const equivalentCount = 2.06;
  const demand = 74.75;
  const ratio = saturationRatio(equivalentCount, demand, 'laundry');
  const competition = competitionScore(equivalentCount, ratio);
  const value = locationScore({ demandFit: demand, accessibility: 67, competition, supportingFacility: 73, risk: 95 });

  it('competition block', () => {
    expect(ratio).toBeCloseTo(0.55, 2);
    expect(saturationReading(ratio)).toBe('healthy');
    expect(densityBand(equivalentCount, 1500)).toBe('low');
    expect(validationBonus(equivalentCount)).toBe(0);
    expect(competition).toBeCloseTo(77.54, 2);
  });

  it('score block', () => {
    expect(value).toBeCloseTo(75.52, 2);
    expect(summarizeScore(value, 81)).toEqual({ value, band: 'suitable', confidence: 81, margin: 8, range: [68, 84] });
  });

  it('segment roles', () => {
    expect([77, 48, 82, 35, 20, 55].map((score) => segmentRole(score))).toEqual([
      'primary',
      'secondary',
      'primary',
      'supporting',
      'insignificant',
      'secondary',
    ]);
  });
});

describe('docs/api.md — POST /api/v1/recommend example', () => {
  const entries = [
    { businessType: 'laundry', value: 75.15, band: 'suitable', status: 'primary', range: [67, 83] },
    { businessType: 'salon', value: 71.6, band: 'suitable', status: 'primary', range: [64, 80] },
    { businessType: 'minimarket', value: 69.2, band: 'moderately_suitable', status: 'alternative', range: [61, 77] },
    { businessType: 'beverages', value: 57.9, band: 'risky', status: 'not_recommended', range: [50, 66] },
    { businessType: 'pharmacy', value: 52.4, band: 'risky', status: 'not_recommended', range: [44, 60] },
  ] as const;

  it.each(entries)('$businessType: score object and status', (entry) => {
    const summary = summarizeScore(entry.value, 81);
    expect(summary.band).toBe(entry.band);
    expect(summary.margin).toBe(8);
    expect(summary.range).toEqual([...entry.range]);
    expect(recommendationStatus(entry.value, 81)).toBe(entry.status);
  });

  it('groups salon and minimarket as equivalent', () => {
    const recommendations = entries
      .slice(0, 3)
      .map((entry) => ({ businessType: entry.businessType, score: { value: entry.value } }));
    expect(groupEquivalent(recommendations)).toEqual([['salon', 'minimarket']]);
  });

  it('needs_validation example at confidence 52', () => {
    expect(summarizeScore(75.15, 52)).toEqual({
      value: 75.15,
      band: 'suitable',
      confidence: 52,
      margin: 12,
      range: [63, 87],
    });
    expect(recommendationStatus(75.15, 52)).toBe('needs_validation');
  });
});
