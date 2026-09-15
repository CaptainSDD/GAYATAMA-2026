import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { GeoapifyPlacesClient } from '../src/geoapify/geoapify-places.client';
import { OSM_SNAPSHOTS, OsmSnapshots } from '../src/osm-snapshots/osm-snapshots';
import { OVERTURE_PLACES, OverturePlaces } from '../src/overture/overture-places';
import { OverpassClient } from '../src/overpass/overpass.client';
import type { OverpassElement } from '../src/overpass/overpass-element';
import { PlacesAggregateClient, type PlaceCountRequest } from '../src/places/places-aggregate.client';
import { configureApp } from '../src/setup';
import { ORIGIN, neighbourhood, offset, siteElements } from './fixtures';

class FakeOverpassClient {
  readonly queryTimeoutSeconds = 25;
  poi: OverpassElement[] | Error = neighbourhood();
  site: OverpassElement[] = siteElements();

  async query(query: string): Promise<OverpassElement[]> {
    const result = query.includes('out center meta') ? this.poi : this.site;
    if (result instanceof Error) throw result;
    return result;
  }
}

const fakeGeoapify = { configured: false, placesAround: async () => [] };

/** An Overture area 20 km from ORIGIN, with one photocopy shop 200 m from its centre. */
const OVERTURE_CENTER = (() => {
  const { lat, lon } = offset(ORIGIN, 20_000, 0);
  return { lat, lng: lon };
})();
const OVERTURE_SHOP = offset(OVERTURE_CENTER, 200, 0);
const OVERTURE = new OverturePlaces([
  {
    version: 1,
    id: 'test-overture',
    name: 'Test area',
    center: OVERTURE_CENTER,
    radiusMeters: 3000,
    release: '2026-08-19.0',
    generatedAt: '2026-09-12T00:00:00Z',
    places: [
      { id: 'shop-1', kind: 'copyshop', name: 'Foto Copy Rizky', lat: OVERTURE_SHOP.lat, lng: OVERTURE_SHOP.lon, confidence: 0.8 },
    ],
  },
]);

/** Places within 300, 800 and 1,500 m, keyed by a type the query includes; every other query counts zero. */
const GOOGLE_CIRCLES = new Map<string, [number, number, number]>([
  ['university', [0, 0, 1]],
  ['school', [0, 2, 3]],
  ['corporate_office', [1, 4, 10]],
  ['bus_stop', [1, 3, 6]],
  ['cafe', [2, 5, 9]],
  ['laundry', [0, 1, 4]],
  ['atm', [1, 2, 2]],
]);

class FakePlacesClient {
  readonly configured = true;
  readonly requests: PlaceCountRequest[] = [];
  failure: Error | null = null;

  async count(request: PlaceCountRequest): Promise<number> {
    this.requests.push(request);
    if (this.failure !== null) throw this.failure;
    const type = [...GOOGLE_CIRCLES.keys()].find((key) => request.includedTypes.includes(key));
    const [within300, within800, within1500] = (type === undefined ? undefined : GOOGLE_CIRCLES.get(type)) ?? [0, 0, 0];
    if (request.radiusMeters === 300) return within300;
    return request.radiusMeters === 800 ? within800 : within1500;
  }
}

/** Response bodies are asserted field by field, so they are read untyped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readJson = (response: Response): Promise<any> => response.json();

describe('API (end to end, fake Overpass)', () => {
  const overpass = new FakeOverpassClient();
  const places = new FakePlacesClient();
  let app: NestExpressApplication;
  let base: string;

  const post = (path: string, body: string | object) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OverpassClient)
      .useValue(overpass)
      .overrideProvider(GeoapifyPlacesClient)
      .useValue(fakeGeoapify)
      // The test location is inside a real snapshot area; these tests exercise the Overpass path.
      .overrideProvider(OSM_SNAPSHOTS)
      .useValue(new OsmSnapshots([]))
      .overrideProvider(OVERTURE_PLACES)
      .useValue(OVERTURE)
      .overrideProvider(PlacesAggregateClient)
      .useValue(places)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;
  });

  afterEach(() => {
    overpass.poi = neighbourhood();
    places.failure = null;
    places.requests.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health', async () => {
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({ status: 'ok', modelVersion: '0.1.0' });
  });

  it('POST /analysis returns a scored, attributed analysis', async () => {
    const response = await post('/analysis', { lat: ORIGIN.lat, lng: ORIGIN.lng, businessType: 'laundry' });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.businessType).toBe('laundry');
    expect(body.score.margin).toBe(Math.round(5 + 0.15 * (100 - body.score.confidence)));
    expect(body.score.range).toEqual([
      Math.max(0, Math.round(body.score.value - body.score.margin)),
      Math.min(100, Math.round(body.score.value + body.score.margin)),
    ]);
    expect(Object.keys(body.components)).toEqual(['demandFit', 'accessibility', 'competition', 'supportingFacility', 'risk']);
    expect(body.competition.radiusMeters).toBe(1500);
    expect(body.competition.strongest[0]).toMatchObject({ kind: 'laundry', zone: 'c', count: 1, source: 'openstreetmap' });
    expect(body.evidence.facilityCount).toBe(15);
    expect(body.dataSource).toMatchObject({
      attribution: '© OpenStreetMap contributors',
      licence: 'ODbL 1.0',
      stale: false,
      via: 'overpass',
      siteConditions: 'available',
      places: { status: 'not_requested', attribution: null },
      overture: null,
    });
    expect(places.requests).toHaveLength(0);
  });

  it('adds Overture photocopy shops inside an Overture area, with their attribution', async () => {
    overpass.poi = neighbourhood(OVERTURE_CENTER);

    const body = await readJson(
      await post('/analysis', { lat: OVERTURE_CENTER.lat, lng: OVERTURE_CENTER.lng, businessType: 'stationery' }),
    );

    expect(body.competition.rawCount).toBe(1);
    expect(body.competition.strongest[0]).toMatchObject({
      id: 'overture/shop-1',
      name: 'Foto Copy Rizky',
      kind: 'copyshop',
      distanceMeters: 200,
      count: 1,
      source: 'overture',
    });
    expect(body.dataSource.overture).toEqual({
      provider: 'Overture Maps Foundation',
      attribution: 'Overture Maps Foundation',
      licence: 'CDLA-Permissive-2.0',
      release: '2026-08-19.0',
      kinds: ['copyshop', 'printer', 'stationery_shop'],
    });
  });

  it('POST /recommend ranks categories under the documented rules', async () => {
    const response = await post('/recommend', { lat: ORIGIN.lat, lng: ORIGIN.lng });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.recommendations.length).toBeLessThanOrEqual(3);
    for (const entry of body.recommendations) {
      expect(['primary', 'alternative', 'needs_validation']).toContain(entry.status);
      expect(typeof entry.rationale).toBe('string');
      expect(typeof entry.differentiator).toBe('string');
    }
    for (const entry of body.notRecommended) {
      expect(entry.score.value).toBeLessThan(60);
      expect(typeof entry.reason).toBe('string');
    }
  });

  it('GET /pois returns facilities and site conditions for local recomputation', async () => {
    const response = await fetch(`${base}/pois?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.site).toEqual({ roadClass: 'service', pedestrianFeatureCount: 2 });
    expect(body.facilities).toHaveLength(15);
    expect(body.facilityCounts).toEqual([]);
    const distances = body.facilities.map((facility: { distanceMeters: number }) => facility.distanceMeters);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));

    const near = await readJson(await fetch(`${base}/pois?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&radius=300`));
    expect(near.facilities).toHaveLength(4);
  });

  describe('with a Google map', () => {
    it('POST /analysis counts Google kinds from Google and keeps OpenStreetMap for the rest', async () => {
      const response = await post('/analysis', {
        lat: ORIGIN.lat,
        lng: ORIGIN.lng,
        businessType: 'beverages',
        googleMap: true,
      });
      const body = await readJson(response);

      expect(response.status).toBe(200);
      // Google replaces only the business kinds: 12 of the 15 mapped facilities stay,
      // and Google adds 9 cafes and 4 laundries.
      expect(body.evidence.facilityCount).toBe(25);
      expect(body.competition.rawCount).toBe(5);
      expect(body.competition.strongest[0]).toMatchObject({
        name: null,
        kind: 'cafe',
        zone: 'a',
        distanceMeters: null,
        count: 2,
        source: 'google',
      });
      expect(body.dataSource).toMatchObject({
        attribution: '© OpenStreetMap contributors',
        places: { provider: 'Google Maps', status: 'used', attribution: 'Google Maps', cacheHit: false },
      });
      expect(body.dataSource.places.kinds).toContain('cafe');
      expect(body.dataSource.places.kinds).not.toContain('copyshop');

      const again = await readJson(await post('/recommend', { lat: ORIGIN.lat, lng: ORIGIN.lng, googleMap: true }));
      expect(again.dataSource.places).toMatchObject({ status: 'used', cacheHit: true });
    });

    it('GET /pois returns counted zones alongside the remaining OpenStreetMap facilities', async () => {
      const body = await readJson(await fetch(`${base}/pois?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&googleMap=true`));

      expect(body.facilities.map((facility: { kind: string }) => facility.kind).sort()).toEqual([
        'atm',
        'boarding_house',
        'campus',
        'government_office',
        'hospital',
        'housing',
        'housing',
        'office',
        'parking',
        'school',
        'school',
        'transit',
      ]);
      // Cafes in all three zones, laundries in two.
      expect(body.facilityCounts).toHaveLength(5);
      expect(body.facilityCounts).toContainEqual({
        kind: 'cafe',
        zone: 'a',
        count: 2,
        scale: 'medium',
        source: 'google',
        dataQuality: 0.65,
      });

      const near = await readJson(await fetch(`${base}/pois?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&radius=300&googleMap=true`));
      expect(near.facilities).toHaveLength(3);
      expect(near.facilityCounts.map((entry: { kind: string }) => entry.kind)).toEqual(['cafe']);
    });

    it('falls back to OpenStreetMap for every kind, with a notice, when Google fails', async () => {
      places.failure = new Error('Google Places responded 403 PERMISSION_DENIED');
      const { lat, lon } = offset(ORIGIN, 100, 0);

      const body = await readJson(await post('/analysis', { lat, lng: lon, businessType: 'laundry', googleMap: true }));

      expect(body.evidence.facilityCount).toBe(15);
      expect(body.dataSource.places).toEqual({
        provider: 'Google Maps',
        status: 'unavailable',
        attribution: null,
        fetchedAt: null,
        cacheHit: null,
        kinds: [],
      });
    });

    it('rejects a googleMap flag that is not a boolean', async () => {
      const response = await post('/recommend', { lat: ORIGIN.lat, lng: ORIGIN.lng, googleMap: 'yes' });
      expect(response.status).toBe(400);
      expect((await fetch(`${base}/pois?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&googleMap=1`)).status).toBe(400);
    });
  });

  it.each([
    ['a coordinate outside Indonesia', { lat: 35.68, lng: 139.69, businessType: 'laundry' }],
    ['an unknown business type', { lat: ORIGIN.lat, lng: ORIGIN.lng, businessType: 'bakery' }],
    ['an unexpected field', { lat: ORIGIN.lat, lng: ORIGIN.lng, businessType: 'laundry', population: 5000 }],
  ])('rejects %s with VALIDATION_FAILED', async (_, body) => {
    const response = await post('/analysis', body);
    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({ statusCode: 400, error: 'VALIDATION_FAILED' });
  });

  it('rejects a malformed JSON body', async () => {
    const response = await post('/analysis', '{"lat": ');
    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({ statusCode: 400, error: 'VALIDATION_FAILED' });
  });

  it('answers 422 INSUFFICIENT_DATA for an unmapped area', async () => {
    overpass.poi = [];
    const { lat, lon } = offset(ORIGIN, 5000, 0);
    const response = await post('/analysis', { lat, lng: lon, businessType: 'laundry' });

    expect(response.status).toBe(422);
    expect(await readJson(response)).toMatchObject({ error: 'INSUFFICIENT_DATA', details: { facilitiesFound: 0 } });
  });

  it('answers 504 UPSTREAM_TIMEOUT when Overpass fails and nothing is cached', async () => {
    overpass.poi = new Error('Overpass down');
    const { lat, lon } = offset(ORIGIN, -10_000, 0);
    const response = await post('/recommend', { lat, lng: lon });

    expect(response.status).toBe(504);
    expect(await readJson(response)).toMatchObject({ error: 'UPSTREAM_TIMEOUT' });
  });

  it('answers 404 NOT_FOUND for unknown routes', async () => {
    const response = await fetch(`${base}/reports/abc`);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({ error: 'NOT_FOUND' });
  });
});
