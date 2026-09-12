import { DEFAULT_OVERPASS_FALLBACK_URLS, MAX_PLACE_COUNT_CACHE_SECONDS, validateEnv } from '../src/config/env';

describe('validateEnv', () => {
  it('uses the public fallback instances by default', () => {
    expect(validateEnv({}).OVERPASS_FALLBACK_URLS).toEqual(DEFAULT_OVERPASS_FALLBACK_URLS);
  });

  it('reads a comma-separated list, where an empty value means no fallbacks', () => {
    expect(validateEnv({ OVERPASS_FALLBACK_URLS: ' https://a.example/api , https://b.example/api ' }).OVERPASS_FALLBACK_URLS).toEqual([
      'https://a.example/api',
      'https://b.example/api',
    ]);
    expect(validateEnv({ OVERPASS_FALLBACK_URLS: '' }).OVERPASS_FALLBACK_URLS).toEqual([]);
  });

  it('rejects a fallback that is not a URL', () => {
    expect(() => validateEnv({ OVERPASS_FALLBACK_URLS: 'not a url' })).toThrow('OVERPASS_FALLBACK_URLS');
  });

  it('caches Google place counts for 7 days by default, and never beyond the 30 days Google allows', () => {
    expect(validateEnv({}).PLACE_COUNT_CACHE_TTL_SECONDS).toBe(604_800);
    expect(validateEnv({ PLACE_COUNT_CACHE_TTL_SECONDS: '2592000' }).PLACE_COUNT_CACHE_TTL_SECONDS).toBe(
      MAX_PLACE_COUNT_CACHE_SECONDS,
    );
    expect(() => validateEnv({ PLACE_COUNT_CACHE_TTL_SECONDS: '2592001' })).toThrow('PLACE_COUNT_CACHE_TTL_SECONDS');
  });

  it('treats an empty Google key as unset', () => {
    expect(validateEnv({ GOOGLE_PLACES_API_KEY: '' }).GOOGLE_PLACES_API_KEY).toBeUndefined();
  });
});
