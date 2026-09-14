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
    const selection = { point: { lat: -6.987654, lng: 110.423456 }, businessType: 'pharmacy' as const };
    expect(parseSelection(serializeSelection(selection))).toEqual(selection);
    expect(serializeSelection({ point: null, businessType: 'food' })).toBe('?type=food');
  });
});
