import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LatLng } from '@gayatama/scoring';
import type { Env } from '../config/env';
import { PLACE_CATEGORIES } from './categories';
import type {
  GeoapifyPlace,
  GeoapifyPlacesResponse,
  GeoapifyReverseResponse,
  GeoapifyReverseResult,
} from './geoapify-place';

const USER_AGENT = 'GAYATAMA/0.1 (+https://github.com/CaptainSDD/GAYATAMA-2026)';
const RETRY_DELAY_MS = 1500;
/** Geoapify returns at most 500 places per request; more needs `offset` paging. */
const PAGE_LIMIT = 500;

export class GeoapifyRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/**
 * Client for the Geoapify Places API. Geoapify replaces Overpass as the POI
 * source because the public Overpass instances give no availability guarantee.
 * The API key stays server-side: the browser only ever talks to this API.
 *
 * Requests are billed per result (1 credit per 20 places), so only categories
 * the engine can map are requested and paging stops at `GEOAPIFY_MAX_PLACES`.
 */
@Injectable()
export class GeoapifyClient {
  private readonly logger = new Logger(GeoapifyClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** False when no API key is configured, in which case the API falls back to Overpass. */
  get enabled(): boolean {
    return this.apiKey !== undefined;
  }

  /** Mapped POI categories within `radiusMeters` of `center`. */
  async places(center: LatLng, radiusMeters: number): Promise<GeoapifyPlace[]> {
    const apiKey = this.apiKey;
    if (apiKey === undefined) throw new GeoapifyRequestError('Geoapify API key is not configured', false);

    const maxPlaces = this.config.get('GEOAPIFY_MAX_PLACES', { infer: true });
    const places: GeoapifyPlace[] = [];
    while (places.length < maxPlaces) {
      const limit = Math.min(PAGE_LIMIT, maxPlaces - places.length);
      const page = await this.page(apiKey, center, radiusMeters, limit, places.length);
      places.push(...page);
      // A short page means the last one.
      if (page.length < limit) break;
    }
    return places;
  }

  /** Human-readable address for a selected point. This never loads POIs or runs scoring. */
  async reverseGeocode(point: LatLng): Promise<GeoapifyReverseResult | null> {
    const apiKey = this.apiKey;
    if (apiKey === undefined) return null;

    const base = this.config.get('GEOAPIFY_GEOCODING_BASE_URL', { infer: true }).replace(/\/+$/, '');
    const url = new URL(`${base}/geocode/reverse`);
    url.searchParams.set('lat', point.lat.toFixed(7));
    url.searchParams.set('lon', point.lng.toFixed(7));
    url.searchParams.set('format', 'json');
    url.searchParams.set('lang', 'id');
    url.searchParams.set('limit', '1');
    url.searchParams.set('apiKey', apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(this.config.get('GEOAPIFY_TIMEOUT_MS', { infer: true })),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new GeoapifyRequestError(timedOut ? 'Geoapify reverse geocoding timed out' : 'Geoapify reverse geocoding failed', false);
    }

    if (!response.ok) {
      throw new GeoapifyRequestError(`Geoapify reverse geocoding responded ${response.status}`, false);
    }

    const body = (await response.json()) as GeoapifyReverseResponse;
    return body.results?.[0] ?? null;
  }

  /** One page, retried once after a pause when the failure looks transient. */
  private async page(
    apiKey: string,
    center: LatLng,
    radiusMeters: number,
    limit: number,
    offset: number,
  ): Promise<GeoapifyPlace[]> {
    try {
      return await this.send(apiKey, center, radiusMeters, limit, offset);
    } catch (error) {
      if (!(error instanceof GeoapifyRequestError) || !error.retryable) throw error;
      this.logger.warn(`${error.message}; retrying once`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return this.send(apiKey, center, radiusMeters, limit, offset);
    }
  }

  private async send(
    apiKey: string,
    center: LatLng,
    radiusMeters: number,
    limit: number,
    offset: number,
  ): Promise<GeoapifyPlace[]> {
    const base = this.config.get('GEOAPIFY_BASE_URL', { infer: true }).replace(/\/+$/, '');
    const url = new URL(`${base}/places`);
    url.searchParams.set('categories', PLACE_CATEGORIES.join(','));
    url.searchParams.set('filter', `circle:${center.lng.toFixed(7)},${center.lat.toFixed(7)},${Math.ceil(radiusMeters)}`);
    url.searchParams.set('limit', String(limit));
    if (offset > 0) url.searchParams.set('offset', String(offset));
    url.searchParams.set('apiKey', apiKey);

    let response: Response;
    try {
      // The URL carries the API key, so it is never logged or put in an error.
      response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(this.config.get('GEOAPIFY_TIMEOUT_MS', { infer: true })),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new GeoapifyRequestError(timedOut ? 'Geoapify request timed out' : 'Geoapify request failed', !timedOut);
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new GeoapifyRequestError(`Geoapify responded ${response.status}`, retryable);
    }

    const body = (await response.json()) as GeoapifyPlacesResponse;
    return body.features ?? [];
  }

  private get apiKey(): string | undefined {
    return this.config.get('GEOAPIFY_API_KEY', { infer: true });
  }
}
