import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LatLng } from '@gayatama/scoring';
import { ConcurrencyLimiter } from '../common/concurrency-limiter';
import type { Env } from '../config/env';

export const PLACES_AGGREGATE_URL = 'https://areainsights.googleapis.com/v1:computeInsights';

/** The API allows 1,200 requests a minute; one new location needs at most 75. */
const MAX_CONCURRENT_REQUESTS = 6;
const RETRY_DELAY_MS = 1000;
const MAX_ERROR_MESSAGE_LENGTH = 200;

export interface PlaceCountRequest {
  center: LatLng;
  radiusMeters: number;
  includedTypes: readonly string[];
  excludedTypes?: readonly string[];
}

export class PlacesRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A function, not an inline check, because a signal can be aborted while a request is awaited. */
const isAborted = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

/** The low-level reason a request failed, such as ENOTFOUND. */
function causeOf(error: unknown): string {
  const cause: unknown = error instanceof Error ? error.cause : undefined;
  if (typeof cause === 'object' && cause !== null) {
    const { code, message } = cause as { code?: unknown; message?: unknown };
    if (typeof code === 'string') return code;
    if (typeof message === 'string') return message;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Client for the Google Places Aggregate API, which answers how many places of
 * given types lie in a circle. It returns counts only: no names, coordinates or
 * opening hours.
 */
@Injectable()
export class PlacesAggregateClient {
  private readonly limiter = new ConcurrencyLimiter(MAX_CONCURRENT_REQUESTS);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get configured(): boolean {
    return this.apiKey !== undefined;
  }

  private get apiKey(): string | undefined {
    return this.config.get('GOOGLE_PLACES_API_KEY', { infer: true });
  }

  /**
   * Operational places matching the types within the circle. A rate-limited,
   * failing or unreachable request is retried once after a pause.
   */
  async count(request: PlaceCountRequest, signal?: AbortSignal): Promise<number> {
    try {
      return await this.limiter.run(() => this.send(request, signal));
    } catch (error) {
      if (!(error instanceof PlacesRequestError) || !error.retryable || isAborted(signal)) throw error;
      await pause(RETRY_DELAY_MS);
      return this.limiter.run(() => this.send(request, signal));
    }
  }

  private async send(request: PlaceCountRequest, signal: AbortSignal | undefined): Promise<number> {
    const apiKey = this.apiKey;
    if (apiKey === undefined) throw new PlacesRequestError('GOOGLE_PLACES_API_KEY is not set', false);
    if (isAborted(signal)) throw new PlacesRequestError('Google Places request cancelled', false);

    const timeout = AbortSignal.timeout(this.config.get('GOOGLE_PLACES_TIMEOUT_MS', { infer: true }));
    let response: Response;
    try {
      response = await fetch(PLACES_AGGREGATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
        body: JSON.stringify(requestBody(request)),
        signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
      });
    } catch (error) {
      if (timeout.aborted) throw new PlacesRequestError('Google Places request timed out', false);
      if (isAborted(signal)) throw new PlacesRequestError('Google Places request cancelled', false);
      throw new PlacesRequestError(`Google Places request failed (${causeOf(error)})`, true);
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new PlacesRequestError(`Google Places responded ${response.status}${await errorDetail(response)}`, retryable);
    }

    const body = (await response.json()) as { count?: string | number };
    // Proto3 JSON omits a zero count.
    const count = Number(body.count ?? 0);
    if (!Number.isInteger(count) || count < 0) {
      throw new PlacesRequestError('Google Places returned an unreadable count', false);
    }
    return count;
  }
}

export function requestBody(request: PlaceCountRequest) {
  const typeFilter: { includedTypes: string[]; excludedTypes?: string[] } = { includedTypes: [...request.includedTypes] };
  if (request.excludedTypes !== undefined && request.excludedTypes.length > 0) {
    typeFilter.excludedTypes = [...request.excludedTypes];
  }
  return {
    insights: ['INSIGHT_COUNT'],
    filter: {
      locationFilter: {
        circle: {
          latLng: { latitude: request.center.lat, longitude: request.center.lng },
          radius: request.radiusMeters,
        },
      },
      typeFilter,
      operatingStatus: ['OPERATING_STATUS_OPERATIONAL'],
    },
  };
}

/** Google's error status and message, such as ` PERMISSION_DENIED: …`. */
async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { status?: unknown; message?: unknown } };
    const status = typeof body.error?.status === 'string' ? ` ${body.error.status}` : '';
    const message =
      typeof body.error?.message === 'string' ? `: ${body.error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}` : '';
    return `${status}${message}`;
  } catch {
    return '';
  }
}
