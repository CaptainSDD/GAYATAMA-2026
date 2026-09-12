import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_RADIUS_METERS, type Facility, type LatLng, type SiteConditions } from '@gayatama/scoring';
import { upstreamUnavailable } from '../common/errors';
import { encodeGeohash, geohashCenter, geohashHalfDiagonalMeters } from '../common/geohash';
import type { Env } from '../config/env';
import { GeoapifyClient } from '../geoapify/geoapify.client';
import { toPlaceFacilities } from '../geoapify/normalize';
import { toFacilities } from '../overpass/normalize';
import { OverpassClient } from '../overpass/overpass.client';
import { buildPoiQuery, buildSiteQuery } from '../overpass/queries';
import { siteConditions } from '../overpass/site';
import { POI_CACHE, type PoiCache } from './poi-cache';

/** Geohash-7 cells are roughly 150 × 150 m. */
export const POI_CELL_PRECISION = 7;
/** Geohash-8 cells are roughly 38 × 19 m — fine enough for road and waterway distances. */
export const SITE_CELL_PRECISION = 8;
const MAX_SITE_ENTRIES = 2000;

export interface PoiSnapshot {
  facilities: Facility[];
  fetchedAt: string;
  cacheHit: boolean;
  /** Served from an expired cache entry because Overpass was unavailable. */
  stale: boolean;
}

export interface SiteLookup {
  site: SiteConditions;
  /** False when the site query failed with nothing cached, so every site input is scored as unknown. */
  available: boolean;
}

@Injectable()
export class PoiService {
  private readonly logger = new Logger(PoiService.name);
  private readonly siteCache = new Map<string, { site: SiteConditions; fetchedAt: number }>();
  // Requests that arrive while the same cell is loading share its Overpass
  // query instead of each sending their own.
  private readonly pendingFacilities = new Map<string, Promise<PoiSnapshot>>();
  private readonly pendingSites = new Map<string, Promise<SiteLookup>>();

  constructor(
    private readonly overpass: OverpassClient,
    @Inject(POI_CACHE) private readonly cache: PoiCache,
    private readonly config: ConfigService<Env, true>,
    private readonly geoapify: GeoapifyClient,
  ) {}

  /**
   * Facilities for the geohash-7 cell containing `point`. The query covers the
   * cell centre plus 1,500 m and the cell's half-diagonal, so the full 1,500 m
   * circle around any point in the cell is included; scoring then measures from
   * the exact point.
   */
  facilitiesAround(point: LatLng): Promise<PoiSnapshot> {
    const cell = encodeGeohash(point, POI_CELL_PRECISION);
    return this.shared(this.pendingFacilities, cell, () => this.loadFacilities(cell));
  }

  /** Conditions at the site itself. A failure here is not fatal: unknown inputs are scored as unknown. */
  siteConditions(point: LatLng): Promise<SiteLookup> {
    const key = encodeGeohash(point, SITE_CELL_PRECISION);
    return this.shared(this.pendingSites, key, () => this.loadSite(key, point));
  }

  private shared<T>(pending: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
    const existing = pending.get(key);
    if (existing !== undefined) return existing;
    const task = load().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }

  private async loadFacilities(cell: string): Promise<PoiSnapshot> {
    const cached = await this.cache.get(cell);
    if (cached !== null && this.isFresh(Date.parse(cached.fetchedAt))) {
      return { facilities: cached.facilities, fetchedAt: cached.fetchedAt, cacheHit: true, stale: false };
    }

    const source = this.geoapify.enabled ? 'geoapify' : 'overpass';
    const label = source === 'geoapify' ? 'Geoapify' : 'Overpass';
    try {
      const radius = ANALYSIS_RADIUS_METERS + geohashHalfDiagonalMeters(cell);
      const facilities = await this.fetchFacilities(cell, radius);
      const entry = { cell, facilities, fetchedAt: new Date().toISOString(), source };
      await this.cache.set(entry);
      return { facilities: entry.facilities, fetchedAt: entry.fetchedAt, cacheHit: false, stale: false };
    } catch (error) {
      if (cached !== null) {
        this.logger.warn(`${label} unavailable, serving stale cache for ${cell}: ${String(error)}`);
        return { facilities: cached.facilities, fetchedAt: cached.fetchedAt, cacheHit: true, stale: true };
      }
      this.logger.warn(`${label} unavailable and nothing cached for ${cell}: ${String(error)}`);
      throw upstreamUnavailable();
    }
  }

  /**
   * Facilities from Geoapify Places when an API key is configured, otherwise
   * from Overpass. Both sources carry OpenStreetMap tags, so the normalised
   * facilities — and their `node/123` ids — are interchangeable.
   */
  private async fetchFacilities(cell: string, radiusMeters: number): Promise<Facility[]> {
    const center = geohashCenter(cell);
    if (this.geoapify.enabled) {
      return toPlaceFacilities(await this.geoapify.places(center, radiusMeters));
    }
    return toFacilities(await this.overpass.query(buildPoiQuery(center, radiusMeters, this.overpass.queryTimeoutSeconds)));
  }

  private async loadSite(key: string, point: LatLng): Promise<SiteLookup> {
    const cached = this.siteCache.get(key);
    if (cached !== undefined && this.isFresh(cached.fetchedAt)) return { site: cached.site, available: true };

    try {
      const elements = await this.overpass.query(buildSiteQuery(point, this.overpass.queryTimeoutSeconds));
      const site = siteConditions(elements, point);
      this.siteCache.delete(key);
      this.siteCache.set(key, { site, fetchedAt: Date.now() });
      if (this.siteCache.size > MAX_SITE_ENTRIES) {
        const oldest = this.siteCache.keys().next().value;
        if (oldest !== undefined) this.siteCache.delete(oldest);
      }
      return { site, available: true };
    } catch (error) {
      this.logger.warn(`Site query failed for ${key}, scoring site inputs as unknown: ${String(error)}`);
      return cached !== undefined ? { site: cached.site, available: true } : { site: {}, available: false };
    }
  }

  private isFresh(fetchedAt: number): boolean {
    return Date.now() - fetchedAt < this.config.get('POI_CACHE_TTL_SECONDS', { infer: true }) * 1000;
  }
}
