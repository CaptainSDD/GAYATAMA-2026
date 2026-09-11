import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_TYPE, isInIndonesia, parseSelection, serializeSelection } from './location';

describe('coverage', () => {
  it('accepts Surabaya and rejects Tokyo', () => {
    expect(isInIndonesia({ lat: -7.3145, lng: 112.7263 })).toBe(true);
    expect(isInIndonesia({ lat: 35.68, lng: 139.69 })).toBe(false);
  });

  it('includes the boundary itself, like the API', () => {
    expect(isInIndonesia({ lat: -11.5, lng: 94.5 })).toBe(true);
    expect(isInIndonesia({ lat: 6.51, lng: 100 })).toBe(false);
  });
});

describe('selection in the URL', () => {
  it('reads a point and business type', () => {
    expect(parseSelection('?lat=-7.3145&lng=112.7263&type=salon')).toEqual({
      point: { lat: -7.3145, lng: 112.7263 },
      businessType: 'salon',
    });
  });

  it('ignores points that are missing, invalid or outside Indonesia', () => {
    expect(parseSelection('').point).toBeNull();
    expect(parseSelection('?lat=&lng=').point).toBeNull();
    expect(parseSelection('?lat=abc&lng=112.7').point).toBeNull();
    expect(parseSelection('?lat=-7.3').point).toBeNull();
    expect(parseSelection('?lat=35.68&lng=139.69').point).toBeNull();
  });

  it('falls back to the default business type for an unknown one', () => {
    expect(parseSelection('?type=bakery').businessType).toBe(DEFAULT_BUSINESS_TYPE);
  });

  it('round-trips', () => {
    const selection = { point: { lat: -7.301234, lng: 112.71789 }, businessType: 'pharmacy' as const };
    expect(parseSelection(serializeSelection(selection))).toEqual(selection);
    expect(serializeSelection({ point: null, businessType: 'food' })).toBe('?type=food');
  });
});
