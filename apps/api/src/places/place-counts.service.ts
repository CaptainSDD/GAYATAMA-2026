import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZONE_LIMITS_METERS, type FacilityCount, type LatLng, type Zone } from '@gayatama/scoring';
import { encodeGeohash, geohashCenter } from '../common/geohash';
import type { Env } from '../config/env';
import { GOOGLE_PLACES_SOURCE, PLACE_COUNT_QUERIES, type PlaceCountQuery } from './place-types';
import { PLACE_COUNTS_CACHE, type CachedPlaceCounts, type PlaceCountsCache } from './place-counts-cache';
import { PlacesAggregateClient } from './places-aggregate.client';

/** Geohash-8 cells are roughly 38 × 19 m, so the circles sit within about 22 m of the chosen point. */
export const PLACE_CELL_PRECISION = 8;

/** Circles counted per kind, largest first. */
const CIRCLES: readonly Zone[] = ['c', 'b', 'a'];

export type PlaceCountsLookup =
  | { status: 'used'; counts: FacilityCount[]; fetchedAt: string; cacheHit: boolean }
  /** No API key is configured, or Google failed: every facility comes from OpenStreetMap. */
  | { status: 'not_configured' | 'unavailable' };

/**
 * Facility counts per zone from the Google Places Aggregate API. Each kind is
 * counted within 1,500, 800 and 300 m of the cell centre, and zone counts are
 * the differences between circles. Counts are only ever used whole: if any
 * request fails, the location falls back to OpenStreetMap for every kind.
 */
@Injectable()
export class PlaceCountsService {
  private readonly logger = new Logger(PlaceCountsService.name);
  private readonly pending = new Map<string, Promise<PlaceCountsLookup>>();

  constructor(
    private readonly client: PlacesAggregateClient,
    private readonly config: ConfigService<Env, true>,
    @Inject(PLACE_COUNTS_CACHE) private readonly cache: PlaceCountsCache,
  ) {}

  /** Never rejects: a failure is reported as `unavailable`. */
  countsAround(point: LatLng): Promise<PlaceCountsLookup> {
    if (!this.client.configured) return Promise.resolve({ status: 'not_configured' });

    const cell = encodeGeohash(point, PLACE_CELL_PRECISION);
    const existing = this.pending.get(cell);
    if (existing !== undefined) return existing;
    const task = this.loadCachedOrFresh(cell).finally(() => this.pending.delete(cell));
    this.pending.set(cell, task);
    return task;
  }

  private async loadCachedOrFresh(cell: string): Promise<PlaceCountsLookup> {
    const cached = await this.cache.get(cell);
    if (cached !== null && this.isFresh(cached)) {
      return { status: 'used', counts: cached.counts, fetchedAt: cached.fetchedAt, cacheHit: true };
    }
    return this.load(cell);
  }

  private async load(cell: string): Promise<PlaceCountsLookup> {
    const center = geohashCenter(cell);
    // The first failure cancels the remaining requests: a partial result is never used.
    const cancel = new AbortController();
    try {
      const groups = await Promise.all(
        PLACE_COUNT_QUERIES.map((query) =>
          this.countByZone(query, center, cancel.signal).catch((error: unknown) => {
            cancel.abort();
            throw error;
          }),
        ),
      );
      const entry: CachedPlaceCounts = { cell, counts: groups.flat(), fetchedAt: new Date().toISOString() };
      await this.cache.set(entry);
      return { status: 'used', counts: entry.counts, fetchedAt: entry.fetchedAt, cacheHit: false };
    } catch (error) {
      this.logger.warn(
        `Google place counts unavailable for ${cell}, using OpenStreetMap: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { status: 'unavailable' };
    }
  }

  /** Counts the largest circle first and stops at an empty circle, since every smaller circle is empty too. */
  private async countByZone(query: PlaceCountQuery, center: LatLng, signal: AbortSignal): Promise<FacilityCount[]> {
    const within: Record<Zone, number> = { a: 0, b: 0, c: 0 };
    for (const zone of CIRCLES) {
      const request = { center, radiusMeters: ZONE_LIMITS_METERS[zone], includedTypes: query.includedTypes };
      within[zone] = await this.client.count(
        query.excludedTypes === undefined ? request : { ...request, excludedTypes: query.excludedTypes },
        signal,
      );
      if (within[zone] === 0) break;
    }

    // Each circle is a separate request, so clamp in case the counts disagree.
    const bands: Record<Zone, number> = {
      a: within.a,
      b: Math.max(0, within.b - within.a),
      c: Math.max(0, within.c - within.b),
    };

    const counts: FacilityCount[] = [];
    for (const zone of ['a', 'b', 'c'] as const) {
      if (bands[zone] === 0) continue;
      const count: FacilityCount = { kind: query.kind, zone, count: bands[zone], source: GOOGLE_PLACES_SOURCE };
      if (query.scale !== undefined) count.scale = query.scale;
      counts.push(count);
    }
    return counts;
  }

  private isFresh(entry: CachedPlaceCounts): boolean {
    const ttlMs = this.config.get('PLACE_COUNT_CACHE_TTL_SECONDS', { infer: true }) * 1000;
    return Date.now() - Date.parse(entry.fetchedAt) < ttlMs;
  }
}
