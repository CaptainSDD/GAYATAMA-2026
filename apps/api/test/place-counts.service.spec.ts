import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../src/config/env';
import { PlaceCountsService } from '../src/places/place-counts.service';
import { PLACE_COUNT_QUERIES } from '../src/places/place-types';
import type { PlaceCountRequest, PlacesAggregateClient } from '../src/places/places-aggregate.client';
import { ORIGIN } from './fixtures';

type Circles = [within300: number, within800: number, within1500: number];

/** Answers from circle counts keyed by a query's first included type; unknown types count zero. */
class FakePlacesClient {
  configured = true;
  readonly requests: PlaceCountRequest[] = [];
  readonly signals: AbortSignal[] = [];
  circles = new Map<string, Circles>();
  failOn: string | null = null;

  async count(request: PlaceCountRequest, signal?: AbortSignal): Promise<number> {
    this.requests.push(request);
    if (signal !== undefined) this.signals.push(signal);
    const type = request.includedTypes[0] ?? '';
    if (type === this.failOn) throw new Error('Google Places responded 403 PERMISSION_DENIED');
    // Other requests finish later, as real ones would.
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (signal?.aborted === true) throw new Error('Google Places request cancelled');
    const [within300, within800, within1500] = this.circles.get(type) ?? [0, 0, 0];
    if (request.radiusMeters === 300) return within300;
    return request.radiusMeters === 800 ? within800 : within1500;
  }
}

function setup(ttlSeconds = 3600) {
  const client = new FakePlacesClient();
  const config = new ConfigService({ PLACE_COUNT_CACHE_TTL_SECONDS: ttlSeconds });
  const service = new PlaceCountsService(
    client as unknown as PlacesAggregateClient,
    config as unknown as ConfigService<Env, true>,
  );
  return { service, client };
}

const QUERIES = PLACE_COUNT_QUERIES.length;

describe('PlaceCountsService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports not_configured without an API key, and requests nothing', async () => {
    const { service, client } = setup();
    client.configured = false;

    await expect(service.countsAround(ORIGIN)).resolves.toEqual({ status: 'not_configured' });
    expect(client.requests).toHaveLength(0);
  });

  it('splits circle counts into zones, counting a smaller circle only when the larger one is not empty', async () => {
    const { service, client } = setup();
    client.circles.set('supermarket', [0, 0, 1]);
    client.circles.set('cafe', [2, 5, 9]);
    client.circles.set('laundry', [0, 1, 4]);

    const result = await service.countsAround(ORIGIN);

    expect(result).toMatchObject({ status: 'used', cacheHit: false });
    expect(result.status === 'used' && result.counts).toEqual([
      { kind: 'cafe', zone: 'a', count: 2, source: 'google' },
      { kind: 'cafe', zone: 'b', count: 3, source: 'google' },
      { kind: 'cafe', zone: 'c', count: 4, source: 'google' },
      { kind: 'laundry', zone: 'b', count: 1, source: 'google' },
      { kind: 'laundry', zone: 'c', count: 3, source: 'google' },
      { kind: 'supermarket', zone: 'c', count: 1, source: 'google' },
    ]);
    // One 1,500 m request per query, plus 800 m for supermarket, and 800 m and 300 m for cafe and laundry.
    expect(client.requests).toHaveLength(QUERIES + 5);
    expect(client.requests.find((request) => request.includedTypes[0] === 'restaurant')?.excludedTypes).toContain('cafe');
  });

  it('never reports a negative zone when separate circle counts disagree', async () => {
    const { service, client } = setup();
    client.circles.set('cafe', [3, 2, 2]);

    const result = await service.countsAround(ORIGIN);

    expect(result.status === 'used' && result.counts).toEqual([{ kind: 'cafe', zone: 'a', count: 3, source: 'google' }]);
  });

  it('shares a load in flight, then serves the cell from cache', async () => {
    const { service, client } = setup();

    const [first, second] = await Promise.all([
      service.countsAround(ORIGIN),
      service.countsAround({ lat: ORIGIN.lat + 0.000001, lng: ORIGIN.lng }),
    ]);
    const third = await service.countsAround(ORIGIN);

    expect(second).toBe(first);
    expect(third).toMatchObject({ status: 'used', cacheHit: true });
    expect(first.status === 'used' && third.status === 'used' && third.fetchedAt === first.fetchedAt).toBe(true);
    expect(client.requests).toHaveLength(QUERIES);
  });

  it('counts again once the cached entry has expired', async () => {
    const { service, client } = setup(0);

    await service.countsAround(ORIGIN);
    await expect(service.countsAround(ORIGIN)).resolves.toMatchObject({ status: 'used', cacheHit: false });
    expect(client.requests).toHaveLength(2 * QUERIES);
  });

  it('falls back when any request fails, cancels the rest, and counts again next time', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, client } = setup();
    client.circles.set('laundry', [1, 2, 3]);
    client.failOn = 'cafe';

    await expect(service.countsAround(ORIGIN)).resolves.toEqual({ status: 'unavailable' });
    expect(client.signals.every((signal) => signal.aborted)).toBe(true);
    expect(client.requests.some((request) => request.radiusMeters !== 1500)).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using OpenStreetMap: Google Places responded 403'));

    client.failOn = null;
    await expect(service.countsAround(ORIGIN)).resolves.toMatchObject({ status: 'used', cacheHit: false });
  });
});
