// Every worked example and rule table in docs/methodology.md, as assertions.
// If the documented methodology and the engine diverge, this suite fails.

import { describe, expect, it } from 'vitest';
import {
  ACCESS_FACTOR,
  BUSINESS_TYPES,
  COMPONENT_WEIGHTS,
  CONFIDENCE_WEIGHTS,
  SEGMENT_WEIGHTS,
  SEGMENTS,
  ZONE_WEIGHTS,
  analyzeCompetition,
  band,
  competitionScore,
  confidenceReading,
  dataQuality,
  demandFit,
  densityBand,
  evaluateFacilities,
  groupEquivalent,
  locationScore,
  operatingHoursFactor,
  parkingScore,
  recommendationStatus,
  saturationRatio,
  saturationReading,
  scoreLocation,
  scoreRange,
  segmentRole,
  segmentScores,
  similarity,
  uncertaintyMargin,
  validationBonus,
  zoneFor,
  type Facility,
} from '../src/index.js';
import { ALL_WEEK, AS_OF, facilityAt, locationInput } from './helpers.js';

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

describe('System-wide rules', () => {
  it('assigns the three distance zones and their weights', () => {
    expect(zoneFor(0)).toBe('a');
    expect(zoneFor(300)).toBe('a');
    expect(zoneFor(300.5)).toBe('b');
    expect(zoneFor(800)).toBe('b');
    expect(zoneFor(800.5)).toBe('c');
    expect(zoneFor(1500)).toBe('c');
    expect(zoneFor(1500.5)).toBeNull();
    expect(ZONE_WEIGHTS).toEqual({ a: 1, b: 0.6, c: 0.25 });
  });

  it('uses the documented Access Factors', () => {
    expect(ACCESS_FACTOR).toEqual({ none: 1, major_road: 0.65, rail_river_toll: 0.4 });
  });

  it('derives the Data Quality bands', () => {
    const quality = (overrides: Partial<Facility>): number =>
      dataQuality(facilityAt('school', 100, { checkDate: undefined, ...overrides }), AS_OF);

    expect(quality({ checkDate: '2026-03-01' })).toBe(1); // updated within 12 months
    expect(quality({ checkDate: '2025-03-01' })).toBe(0.85); // 13–24 months old
    expect(quality({ name: 'SDN Ketintang 1' })).toBe(0.65); // date unknown, record reasonably complete
    expect(quality({ checkDate: '2024-03-01' })).toBe(0.4); // older than 24 months
    expect(quality({ doubtfulCategory: true, checkDate: '2026-08-01' })).toBe(0.4); // category doubtful
    expect(quality({ closed: true })).toBe(0); // permanently closed
  });
});

describe('1. Location Potential Score', () => {
  it('weights the five components 35 / 20 / 20 / 15 / 10', () => {
    expect(COMPONENT_WEIGHTS).toEqual({
      demandFit: 0.35,
      accessibility: 0.2,
      competition: 0.2,
      supportingFacility: 0.15,
      risk: 0.1,
    });
    expect(sum(Object.values(COMPONENT_WEIGHTS))).toBeCloseTo(1, 12);
  });

  it('worked example: laundry scores 75.30, displayed as 75/100 "Suitable"', () => {
    const score = locationScore({ demandFit: 75, accessibility: 67, competition: 76, supportingFacility: 73, risk: 95 });
    expect(score).toBeCloseTo(75.3, 9);
    expect(Math.round(score)).toBe(75);
    expect(band(score)).toBe('suitable');
  });

  it('interprets scores into five bands', () => {
    expect(band(100)).toBe('highly_suitable');
    expect(band(80)).toBe('highly_suitable');
    expect(band(79.99)).toBe('suitable');
    expect(band(70)).toBe('suitable');
    expect(band(69.99)).toBe('moderately_suitable');
    expect(band(60)).toBe('moderately_suitable');
    expect(band(59.99)).toBe('risky');
    expect(band(50)).toBe('risky');
    expect(band(49.99)).toBe('not_recommended');
    expect(band(0)).toBe('not_recommended');
  });
});

describe('2. Business Type Recommendation', () => {
  it('segment weights: every row sums to 100%', () => {
    for (const businessType of BUSINESS_TYPES) {
      expect(sum(SEGMENTS.map((segment) => SEGMENT_WEIGHTS[businessType][segment]))).toBeCloseTo(1, 12);
    }
  });

  it('worked example: laundry Demand Fit is 74.75', () => {
    const segments = { student: 77, office: 48, resident: 82, commuter: 35, health: 20, general: 55 };
    expect(demandFit(segments, 'laundry')).toBeCloseTo(74.75, 9);
  });

  it('applies the recommendation rules', () => {
    expect(recommendationStatus(70, 60)).toBe('primary');
    expect(recommendationStatus(69.99, 60)).toBe('alternative');
    expect(recommendationStatus(60, 60)).toBe('alternative');
    expect(recommendationStatus(75, 59.99)).toBe('needs_validation');
    expect(recommendationStatus(60, 40)).toBe('needs_validation');
    expect(recommendationStatus(59.99, 90)).toBe('not_recommended');
    expect(recommendationStatus(59.99, 45)).toBe('not_recommended');
  });

  it('treats scores 3 points apart or less as effectively equivalent', () => {
    const ranked = (values: number[]) =>
      values.map((value, index) => ({ businessType: BUSINESS_TYPES[index]!, score: { value } }));

    expect(groupEquivalent(ranked([75, 72, 60]))).toEqual([['beverages', 'food']]);
    expect(groupEquivalent(ranked([75, 71.9, 60]))).toEqual([]);
    expect(groupEquivalent(ranked([75, 73, 71]))).toEqual([['beverages', 'food', 'laundry']]);
  });
});

describe('3. Competitor Analysis', () => {
  it('rates similarity for a coffee shop', () => {
    expect(similarity('beverages', facilityAt('cafe', 100))).toBe(1);
    expect(similarity('beverages', facilityAt('bubble_tea', 100))).toBe(0.6);
    expect(similarity('beverages', facilityAt('restaurant', 100, { servesCoffee: true }))).toBe(0.3);
    expect(similarity('beverages', facilityAt('restaurant', 100))).toBe(0);
  });

  it('worked example: five businesses on the map are 3.80 competitor-equivalents', () => {
    const facilities = [
      facilityAt('cafe', 120, { openingHours: ALL_WEEK }),
      facilityAt('cafe', 250, { openingHours: ALL_WEEK }),
      facilityAt('bubble_tea', 180, { openingHours: ALL_WEEK }),
      facilityAt('cafe', 450, { openingHours: ALL_WEEK }),
      facilityAt('cafe', 700, { openingHours: ALL_WEEK }),
    ];
    const result = analyzeCompetition(evaluateFacilities(locationInput(facilities)), 'beverages', 60);

    expect(result.rawCount).toBe(5);
    expect(result.equivalentCount).toBeCloseTo(3.8, 9);
    expect(result.density).toBe('moderate');
  });

  it('applies the Operating-Hours Factor', () => {
    const target = [{ day: 0, from: 480, to: 1080 }]; // Monday 08:00–18:00

    expect(operatingHoursFactor(target, [{ day: 0, from: 480, to: 1080 }])).toBe(1); // strong overlap
    expect(operatingHoursFactor(target, [{ day: 0, from: 780, to: 1320 }])).toBe(0.6); // partial
    expect(operatingHoursFactor(target, [{ day: 0, from: 1020, to: 1320 }])).toBe(0.3); // minimal
    expect(operatingHoursFactor(target, undefined)).toBe(0.8); // unknown hours
    expect(operatingHoursFactor(target, [{ day: 0, from: 1140, to: 1380 }])).toBe(0.1); // closed during target hours
  });

  it('bands density for 800 m and 1,500 m primary radii', () => {
    expect(densityBand(1.99, 800)).toBe('low');
    expect(densityBand(2, 800)).toBe('moderate');
    expect(densityBand(4.99, 800)).toBe('moderate');
    expect(densityBand(5, 800)).toBe('high');
    expect(densityBand(8.99, 800)).toBe('high');
    expect(densityBand(9, 800)).toBe('very_high');

    expect(densityBand(2.99, 1500)).toBe('low');
    expect(densityBand(3, 1500)).toBe('moderate');
    expect(densityBand(7, 1500)).toBe('high');
    expect(densityBand(12, 1500)).toBe('very_high');
  });

  it('measures saturation relative to demand', () => {
    expect(saturationRatio(4, 80, 'laundry')).toBeCloseTo(1, 12); // capacity 80 / 20 = 4
    expect(saturationRatio(4, 10, 'laundry')).toBeCloseTo(4, 12); // capacity floors at 1

    expect(saturationReading(0.49)).toBe('not_saturated');
    expect(saturationReading(0.5)).toBe('healthy');
    expect(saturationReading(0.99)).toBe('healthy');
    expect(saturationReading(1)).toBe('becoming_saturated');
    expect(saturationReading(1.5)).toBe('saturated');
    expect(saturationReading(2)).toBe('heavily_saturated');
  });

  it('treats zero competitors as a penalty, not a prize', () => {
    expect(validationBonus(0)).toBe(-10);
    expect(validationBonus(0.5)).toBe(5);
    expect(validationBonus(2)).toBe(5);
    expect(validationBonus(2.01)).toBe(0);
    expect(validationBonus(5)).toBe(0);
    expect(validationBonus(5.01)).toBe(-5);
    expect(competitionScore(0, 0)).toBe(85);
  });

  it('clamps the Competition Opportunity score to 0–100', () => {
    expect(competitionScore(10, 4)).toBe(0);
    expect(competitionScore(1, 0)).toBe(100);
  });
});

describe('4. Target Market Insight', () => {
  it('worked example: Student Score is 76.52, shown as 77, primary target', () => {
    const facilities = [
      facilityAt('campus', 250),
      facilityAt('school', 500),
      facilityAt('school', 500),
      facilityAt('boarding_house', 700, { scale: 'large' }),
    ];
    const scores = segmentScores(evaluateFacilities(locationInput(facilities)));

    expect(scores.student).toBeCloseTo(76.52, 9);
    expect(Math.round(scores.student)).toBe(77);
    expect(segmentRole(scores.student)).toBe('primary');
  });

  it('caps each segment at 100', () => {
    const campuses = Array.from({ length: 4 }, () => facilityAt('campus', 100));
    expect(segmentScores(evaluateFacilities(locationInput(campuses))).student).toBe(100);
  });

  it('assigns segment roles', () => {
    expect(segmentRole(70)).toBe('primary');
    expect(segmentRole(69.99)).toBe('secondary');
    expect(segmentRole(45)).toBe('secondary');
    expect(segmentRole(44.99)).toBe('supporting');
    expect(segmentRole(25)).toBe('supporting');
    expect(segmentRole(24.99)).toBe('insignificant');
  });
});

describe('5. Business Simulation & Report', () => {
  it('adding parking moves the parking sub-score from 20 to 70', () => {
    expect(parkingScore([], 0)).toBe(20);
    expect(parkingScore([], 10)).toBe(70);
  });

  it('competitors closed during the business hours exert 10% of their pressure', () => {
    expect(operatingHoursFactor([{ day: 5, from: 360, to: 720 }], [{ day: 5, from: 1080, to: 1320 }])).toBe(0.1);
  });

  it('caps the Location Score gain from delivery at 5 points', () => {
    const input = locationInput([
      ...Array.from({ length: 6 }, () => facilityAt('housing', 1000)),
      ...Array.from({ length: 6 }, () => facilityAt('boarding_house', 1000)),
      facilityAt('laundry', 100, { openingHours: ALL_WEEK }),
      facilityAt('laundry', 150, { openingHours: ALL_WEEK }),
    ]);
    const base = scoreLocation(input, 'laundry');
    const withDelivery = scoreLocation(input, 'laundry', { delivery: true });

    expect(withDelivery.delivery?.uncappedScore).toBeGreaterThan(base.score.value + 5);
    expect(withDelivery.delivery?.capApplied).toBe(true);
    expect(withDelivery.score.value).toBeCloseTo(base.score.value + 5, 9);
  });

  it('applies delivery only to laundry and food', () => {
    const input = locationInput([facilityAt('housing', 1000)]);
    const result = scoreLocation(input, 'salon', { delivery: true });

    expect(result.delivery).toBeUndefined();
    expect(result.score.value).toBe(scoreLocation(input, 'salon').score.value);
  });
});

describe('Confidence Score and warnings', () => {
  it('weights completeness, freshness, cross-source validation and coverage 40 / 25 / 20 / 15', () => {
    expect(CONFIDENCE_WEIGHTS).toEqual({
      completeness: 0.4,
      freshness: 0.25,
      crossSourceValidation: 0.2,
      areaCoverage: 0.15,
    });
  });

  it('worked example: score 75 with Confidence 81 is displayed as 75 ± 8, range 67–83', () => {
    const margin = uncertaintyMargin(81);
    expect(margin).toBe(8);
    expect(scoreRange(75, margin)).toEqual([67, 83]);
  });

  it('reads confidence into five levels', () => {
    expect(confidenceReading(85)).toBe('high');
    expect(confidenceReading(84.99)).toBe('good');
    expect(confidenceReading(70)).toBe('good');
    expect(confidenceReading(55)).toBe('moderate');
    expect(confidenceReading(40)).toBe('low');
    expect(confidenceReading(39.99)).toBe('very_low');
  });

  it('gives no definitive recommendation below a confidence of 40', () => {
    expect(recommendationStatus(90, 39.99)).toBeNull();
  });
});
