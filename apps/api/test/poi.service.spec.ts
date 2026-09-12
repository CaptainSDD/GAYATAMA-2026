import type { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encodeGeohash } from '../src/common/geohash';
import type { Env } from '../src/config/env';
import type { GeoapifyClient } from '../src/geoapify/geoapify.client';
import type { GeoapifyPlace } from '../src/geoapify/geoapify-place';
import type { OverpassClient } from '../src/overpass/overpass.client';
import type { OverpassElement } from '../src/overpass/overpass-element';
import { InMemoryPoiCache, LayeredPoiCache, type CachedPois, type PoiCache } from '../src/poi/poi-cache';
import { PoiService } from '../src/poi/poi.service';
import { ORIGIN, neighbourhood, siteElements } from './fixtures';

class FakeOverpass {
  readonly queryTimeoutSeconds = 25;
  readonly queries: string[] = [];
  poi: OverpassElement[] | Error = neighbourhood();
  site: OverpassElement[] | Error = siteElements();

  async query(query: string): Promise<OverpassElement[]> {
    this.queries.push(query);
    const result = query.includes('out center meta') ? this.poi : this.site;
    if (result instanceof Error) throw result;
    return result;
  }
}

class FakeGeoapify {
  enabled = false;
  readonly requests: { radiusMeters: number }[] = [];
  result: GeoapifyPlace[] | Error = [];

  async places(_center: unknown, radiusMeters: number): Promise<GeoapifyPlace[]> {
    this.requests.push({ radiusMeters });
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

function setup(ttlSeconds = 3600) {
  const overpass = new FakeOverpass();
  const geoapify = new FakeGeoapify();
  const cache = new InMemoryPoiCache();
  const config = new ConfigService({ POI_CACHE_TTL_SECONDS: ttlSeconds, OVERPASS_TIMEOUT_MS: 30_000 });
  const service = new PoiService(
    overpass as unknown as OverpassClient,
    cache,
    config as unknown as ConfigService<Env, true>,
    geoapify as unknown as GeoapifyClient,
  );
  return { service, overpass, geoapify, cache };
}

const poiQueries = (overpass: FakeOverpass) => overpass.queries.filter((query) => query.includes('out center meta'));

describe('PoiService.facilitiesAround', () => {
  it('fetches on a miss, then serves the cell from cache', async () => {
    const { service, overpass } = setup();

    const first = await service.facilitiesAround(ORIGIN);
    const second = await service.facilitiesAround({ lat: ORIGIN.lat + 0.00001, lng: ORIGIN.lng });

    expect(first).toMatchObject({ cacheHit: false, stale: false });
    expect(first.facilities).toHaveLength(15);
    expect(second).toMatchObject({ cacheHit: true, stale: false, fetchedAt: first.fetchedAt });
    expect(poiQueries(overpass)).toHaveLength(1);
  });

  it('shares one Overpass query between requests that arrive while a cell is loading', async () => {
    const { service, overpass } = setup();

    const [first, second] = await Promise.all([
      service.facilitiesAround(ORIGIN),
      service.facilitiesAround({ lat: ORIGIN.lat + 0.00001, lng: ORIGIN.lng }),
    ]);

    expect(second).toBe(first);
    expect(poiQueries(overpass)).toHaveLength(1);
  });

  it('queries 1,500 m plus the half-diagonal of the cell', async () => {
    const { service, overpass } = setup();
    await service.facilitiesAround(ORIGIN);
    const radius = Number(/around:(\d+)/.exec(overpass.queries[0] ?? '')?.[1]);
    expect(radius).toBeGreaterThan(1600);
    expect(radius).toBeLessThan(1620);
  });

  it('serves an expired entry, flagged stale, when Overpass fails', async () => {
    const { service, overpass, cache } = setup(0);
    await cache.set({ cell: encodeGeohash(ORIGIN, 7), facilities: [], fetchedAt: '2026-01-01T00:00:00Z' });
    overpass.poi = new Error('Overpass down');

    await expect(service.facilitiesAround(ORIGIN)).resolves.toMatchObject({
      cacheHit: true,
      stale: true,
      fetchedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('fails with UPSTREAM_TIMEOUT when Overpass fails and nothing is cached', async () => {
    const { service, overpass } = setup();
    overpass.poi = new Error('Overpass down');
    await expect(service.facilitiesAround(ORIGIN)).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
  });

  it('retries a failed cell on the next request instead of reusing the failure', async () => {
    const { service, overpass } = setup();
    overpass.poi = new Error('Overpass down');
    await expect(service.facilitiesAround(ORIGIN)).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });

    overpass.poi = neighbourhood();
    await expect(service.facilitiesAround(ORIGIN)).resolves.toMatchObject({ cacheHit: false, stale: false });
    expect(poiQueries(overpass)).toHaveLength(2);
  });
});

describe('PoiService.siteConditions', () => {
  it('derives and caches site conditions', async () => {
    const { service, overpass } = setup();
    expect(await service.siteConditions(ORIGIN)).toEqual({
      site: { roadClass: 'service', pedestrianFeatureCount: 2 },
      available: true,
    });
    await service.siteConditions(ORIGIN);
    expect(overpass.queries).toHaveLength(1);
  });

  it('shares one query between concurrent requests for the same site', async () => {
    const { service, overpass } = setup();
    await Promise.all([service.siteConditions(ORIGIN), service.siteConditions(ORIGIN)]);
    expect(overpass.queries).toHaveLength(1);
  });

  it('reports site inputs as unavailable when the query fails', async () => {
    const { service, overpass } = setup();
    overpass.site = new Error('Overpass down');
    expect(await service.siteConditions(ORIGIN)).toEqual({ site: {}, available: false });
  });
});

describe('LayeredPoiCache', () => {
  const entry: CachedPois = { cell: 'abc', facilities: [], fetchedAt: '2026-09-01T00:00:00Z' };
  const failing: PoiCache = {
    get: () => Promise.reject(new Error('unavailable')),
    set: () => Promise.reject(new Error('unavailable')),
  };

  it('keeps working in memory when Firestore fails', async () => {
    const warn = jest.fn();
    const cache = new LayeredPoiCache(new InMemoryPoiCache(), failing, { warn } as unknown as Logger);

    expect(await cache.get('abc')).toBeNull();
    await cache.set(entry);
    expect(await cache.get('abc')).toEqual(entry);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('fills memory from the durable cache', async () => {
    const memory = new InMemoryPoiCache();
    const durable = new InMemoryPoiCache();
    await durable.set(entry);
    const cache = new LayeredPoiCache(memory, durable, { warn: jest.fn() } as unknown as Logger);

    expect(await cache.get('abc')).toEqual(entry);
    expect(await memory.get('abc')).toEqual(entry);
  });
});
