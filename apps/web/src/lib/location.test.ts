import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_TYPE,
  isInIndonesia,
  isInSemarangCoverage,
  parseSelection,
  serializeSelection,
} from './location';

describe('coverage', () => {
  it('accepts Semarang and rejects Tokyo', () => {
    expect(isInIndonesia({ lat: -6.9882533, lng: 110.4355751 })).toBe(true);
    expect(isInIndonesia({ lat: 35.68, lng: 139.69 })).toBe(false);
  });

  it('accepts the Semarang service area and rejects Surabaya', () => {
    expect(isInSemarangCoverage({ lat: -6.9904, lng: 110.4229 })).toBe(true);
    expect(isInSemarangCoverage({ lat: -7.3145, lng: 112.7263 })).toBe(false);
  });

  it('uses the city shape, not merely its surrounding rectangle', () => {
    expect(isInSemarangCoverage({ lat: -6.93, lng: 110.3 })).toBe(false);
    expect(isInSemarangCoverage({ lat: -7.11, lng: 110.49 })).toBe(false);
  });

  it('includes the Indonesia boundary itself, like the API', () => {
    expect(isInIndonesia({ lat: -11.5, lng: 94.5 })).toBe(true);
    expect(isInIndonesia({ lat: 6.51, lng: 100 })).toBe(false);
  });
});

describe('selection in the URL', () => {
  it('reads a point and business type', () => {
    expect(parseSelection('?lat=-6.988253&lng=110.435575&type=salon')).toEqual({
      point: { lat: -6.988253, lng: 110.435575 },
      businessType: 'salon',
      // No `w`, so the documented baseline.
      weights: null,
    });
  });

  it('ignores points that are missing, invalid or outside the Semarang coverage area', () => {
    expect(parseSelection('').point).toBeNull();
    expect(parseSelection('?lat=&lng=').point).toBeNull();
    expect(parseSelection('?lat=abc&lng=112.7').point).toBeNull();
    expect(parseSelection('?lat=-7.3').point).toBeNull();
    expect(parseSelection('?lat=35.68&lng=139.69').point).toBeNull();
    expect(parseSelection('?lat=-7.3145&lng=112.7263').point).toBeNull();
  });

  it('falls back to the default business type for an unknown one', () => {
    expect(parseSelection('?type=bakery').businessType).toBe(DEFAULT_BUSINESS_TYPE);
  });

  it('round-trips', () => {
    const selection = { point: { lat: -6.987654, lng: 110.423456 }, businessType: 'pharmacy' as const, weights: null };
    expect(parseSelection(serializeSelection(selection))).toEqual(selection);
    expect(serializeSelection({ point: null, businessType: 'food', weights: null })).toBe('?type=food');
  });

  it('round-trips custom weights, so a shared link shows the score its sender saw', () => {
    const weights = { demandFit: 50, accessibility: 10, competition: 20, supportingFacility: 10, risk: 10 };
    const selection = { point: { lat: -6.987654, lng: 110.423456 }, businessType: 'laundry' as const, weights };
    expect(parseSelection(serializeSelection(selection))).toEqual(selection);
  });

  it('ignores a malformed or all-zero weight list rather than scoring with it', () => {
    expect(parseSelection('?type=laundry&w=50,10,20').weights).toBeNull();
    expect(parseSelection('?type=laundry&w=0,0,0,0,0').weights).toBeNull();
    expect(parseSelection('?type=laundry&w=50,10,20,10,abc').weights).toBeNull();
  });
});
