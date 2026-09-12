import type { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LatLng } from '@gayatama/scoring';
import { encodeGeohash } from '../src/common/geohash';
import type { Env } from '../src/config/env';
import { OsmSnapshots, type OsmSnapshot } from '../src/osm-snapshots/osm-snapshots';
import type { OverturePlace } from '../src/overture/overture-place';
import { OverturePlaces, type OvertureArea } from '../src/overture/overture-places';
import type { OverpassClient } from '../src/overpass/overpass.client';
import type { OverpassElement } from '../src/overpass/overpass-element';
import { InMemoryPoiCache, LayeredPoiCache, type CachedPois, type PoiCache } from '../src/poi/poi-cache';
import { PoiService } from '../src/poi/poi.service';
import { ORIGIN, neighbourhood, node, offset, siteElements } from './fixtures';

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

function setup(ttlSeconds = 3600, snapshots = new OsmSnapshots([]), overture = new OverturePlaces([])) {
  const overpass = new FakeOverpass();
  const cache = new InMemoryPoiCache();
  const config = new ConfigService({ POI_CACHE_TTL_SECONDS: ttlSeconds, OVERPASS_TIMEOUT_MS: 30_000 });
  const service = new PoiService(
    overpass as unknown as OverpassClient,
    cache,
    config as unknown as ConfigService<Env, true>,
    snapshots,
    overture,
  );
  return { service, overpass, cache };
}

const poiQueries = (overpass: FakeOverpass) => overpass.queries.filter((query) => query.includes('out center meta'));

const snapshotAround = (center: LatLng, radiusMeters: number): OsmSnapshot => ({
  version: 1,
  id: 'test-area',
  name: 'Test area',
  center,
  radiusMeters,
  dataTimestamp: '2026-09-10T20:00:00Z',
  source: 'test',
  generatedAt: '2026-09-11T00:00:00Z',
  pois: neighbourhood(),
  site: siteElements(),
});

describe('PoiService.facilitiesAround', () => {
  it('fetches on a miss, then serves the cell from cache', async () => {
    const { service, overpass } = setup();

    const first = await service.facilitiesAround(ORIGIN);
    const second = await service.facilitiesAround({ lat: ORIGIN.lat + 0.00001, lng: ORIGIN.lng });

    expect(first).toMatchObject({ cacheHit: false, stale: false, via: 'overpass' });
    expect(first.facilities).toHaveLength(15);
    expect(second).toMatchObject({ cacheHit: true, stale: false, fetchedAt: first.fetchedAt, via: 'overpass' });
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

describe('PoiService with an OSM snapshot', () => {
  it('answers from a snapshot covering the area, identically to Overpass and without querying it', async () => {
    // The same elements on both paths: fixtures number elements afresh on every call.
    const area = snapshotAround(ORIGIN, 3000);
    const live = setup();
    live.overpass.poi = area.pois;
    live.overpass.site = area.site;
    const offline = setup(3600, new OsmSnapshots([area]));

    const fromOverpass = await live.service.facilitiesAround(ORIGIN);
    const fromSnapshot = await offline.service.facilitiesAround(ORIGIN);

    expect(fromSnapshot).toMatchObject({ via: 'snapshot', fetchedAt: '2026-09-10T20:00:00Z', cacheHit: false, stale: false });
    expect(fromSnapshot.facilities).toEqual(fromOverpass.facilities);
    expect(await offline.service.siteConditions(ORIGIN)).toEqual(await live.service.siteConditions(ORIGIN));
    expect(offline.overpass.queries).toHaveLength(0);
  });

  it('uses Overpass when the snapshot does not contain the whole query circle', async () => {
    const { service, overpass } = setup(3600, new OsmSnapshots([snapshotAround(ORIGIN, 1500)]));
    await expect(service.facilitiesAround(ORIGIN)).resolves.toMatchObject({ via: 'overpass' });
    expect(poiQueries(overpass)).toHaveLength(1);
  });
});

describe('PoiService with Overture places', () => {
  const overtureArea = (center: LatLng, places: OverturePlace[]): OvertureArea => ({
    version: 1,
    id: 'test-overture',
    name: 'Test area',
    center,
    radiusMeters: 3000,
    release: '2026-08-19.0',
    generatedAt: '2026-09-12T00:00:00Z',
    places,
  });

  const shop = (id: string, name: string, north: number, east: number): OverturePlace => {
    const { lat, lon } = offset(ORIGIN, north, east);
    return { id, kind: 'copyshop', name, lat, lng: lon, confidence: 0.8 };
  };

  function setupWithShops() {
    const overture = new OverturePlaces([
      overtureArea(ORIGIN, [shop('new', 'Rama Fotocopy', 300, 300), shop('duplicate', 'Abadi Fotocopy', 10, 600)]),
    ]);
    const context = setup(3600, new OsmSnapshots([]), overture);
    context.overpass.poi = [...neighbourhood(), node({ shop: 'copyshop', name: 'Mantab Fotocopy' }, 0, 600)];
    return context;
  }

  it('adds the photocopy shops OpenStreetMap lacks, and skips the ones it already has', async () => {
    const { service } = setupWithShops();

    const result = await service.facilitiesAround(ORIGIN);

    expect(result.overture).toEqual({ areaId: 'test-overture', release: '2026-08-19.0', added: 1 });
    expect(result.facilities.filter((facility) => facility.kind === 'copyshop').map((facility) => facility.name)).toEqual([
      'Mantab Fotocopy',
      'Rama Fotocopy',
    ]);
  });

  it('keeps Overture shops out of the POI cache', async () => {
    const { service, cache } = setupWithShops();

    await service.facilitiesAround(ORIGIN);
    const cached = await cache.get(encodeGeohash(ORIGIN, 7));

    expect(cached?.facilities.some((facility) => facility.id.startsWith('overture/'))).toBe(false);
  });

  it('adds nothing outside the Overture areas', async () => {
    const { lat, lon } = offset(ORIGIN, 20_000, 0);
    const far = new OverturePlaces([overtureArea({ lat, lng: lon }, [shop('new', 'Rama Fotocopy', 300, 300)])]);
    const { service } = setup(3600, new OsmSnapshots([]), far);

    const result = await service.facilitiesAround(ORIGIN);

    expect(result.overture).toBeNull();
    expect(result.facilities).toHaveLength(15);
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
