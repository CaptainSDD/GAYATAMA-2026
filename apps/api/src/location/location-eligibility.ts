import { Injectable, Logger } from '@nestjs/common';
import type { LatLng } from '@gayatama/scoring';
import { unsuitableLocation } from '../common/errors';
import { GeoapifyClient } from '../geoapify/geoapify.client';
import type { GeoapifyReverseResult } from '../geoapify/geoapify-place';

export type IneligibleSurface = 'water' | 'wetland' | 'aquaculture';

export type LocationEligibility =
  | { status: 'eligible' }
  | { status: 'unknown' }
  | { status: 'ineligible'; reason: IneligibleSurface };

export interface LocationLookup {
  result: GeoapifyReverseResult | null;
  eligibility: LocationEligibility;
}

const WATER_VALUES = new Set(['water', 'bay', 'sea', 'ocean', 'reservoir', 'basin', 'strait']);
const WETLAND_VALUES = new Set(['wetland', 'marsh', 'swamp', 'mangrove']);
const AQUACULTURE_VALUES = new Set(['aquaculture', 'fishpond', 'salt_pond']);

/**
 * Treat only explicit mapped surface classifications as a rejection. A failed
 * or coarse reverse lookup remains usable, rather than blocking valid sites
 * when a third-party geocoder is temporarily unavailable.
 */
export function classifyLocation(result: GeoapifyReverseResult | null): LocationEligibility {
  if (result === null) return { status: 'unknown' };

  const raw = result.datasource?.raw ?? {};
  const categories = [result.category, ...(result.categories ?? []), result.result_type]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase());
  const rawValue = (key: string) => (typeof raw[key] === 'string' ? raw[key].toLowerCase() : '');

  if (
    categories.some((value) => value === 'natural.water' || value.startsWith('natural.water.')) ||
    WATER_VALUES.has(rawValue('natural')) ||
    WATER_VALUES.has(rawValue('water')) ||
    WATER_VALUES.has(rawValue('place')) ||
    rawValue('waterway') !== ''
  ) {
    return { status: 'ineligible', reason: 'water' };
  }
  if (categories.some((value) => value === 'natural.wetland' || value.startsWith('natural.wetland.')) || WETLAND_VALUES.has(rawValue('natural'))) {
    return { status: 'ineligible', reason: 'wetland' };
  }
  if (AQUACULTURE_VALUES.has(rawValue('landuse')) || AQUACULTURE_VALUES.has(rawValue('man_made'))) {
    return { status: 'ineligible', reason: 'aquaculture' };
  }
  return { status: 'eligible' };
}

const CACHE_MS = 10 * 60_000;

/** Shared reverse-geocode lookup and surface eligibility gate for all routes. */
@Injectable()
export class LocationEligibilityService {
  private readonly logger = new Logger(LocationEligibilityService.name);
  private readonly cache = new Map<string, { expiresAt: number; value: LocationLookup }>();

  constructor(private readonly geoapify: GeoapifyClient) {}

  async lookup(point: LatLng): Promise<LocationLookup> {
    const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
    const cached = this.cache.get(key);
    if (cached !== undefined && cached.expiresAt > Date.now()) return cached.value;

    let result: GeoapifyReverseResult | null = null;
    try {
      result = await this.geoapify.reverseGeocode(point);
    } catch (error) {
      // Surface validation is conservative: a provider outage must not turn an
      // otherwise valid point into a false rejection.
      this.logger.warn(error instanceof Error ? error.message : 'Reverse geocoding failed');
    }
    const value = { result, eligibility: classifyLocation(result) };
    this.cache.set(key, { expiresAt: Date.now() + CACHE_MS, value });
    return value;
  }

  async assertEligible(point: LatLng): Promise<void> {
    const { eligibility } = await this.lookup(point);
    if (eligibility.status === 'ineligible') throw unsuitableLocation(eligibility.reason);
  }
}
