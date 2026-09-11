import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { OverpassClient } from '../src/overpass/overpass.client';
import type { OverpassElement } from '../src/overpass/overpass-element';
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

/** Response bodies are asserted field by field, so they are read untyped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readJson = (response: Response): Promise<any> => response.json();

describe('API (end to end, fake Overpass)', () => {
  const overpass = new FakeOverpassClient();
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
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;
  });

  afterEach(() => {
    overpass.poi = neighbourhood();
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
    expect(body.evidence.facilityCount).toBe(15);
    expect(body.dataSource).toMatchObject({
      attribution: '© OpenStreetMap contributors',
      licence: 'ODbL 1.0',
      stale: false,
      siteConditions: 'available',
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
    const distances = body.facilities.map((facility: { distanceMeters: number }) => facility.distanceMeters);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));

    const near = await readJson(await fetch(`${base}/pois?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&radius=300`));
    expect(near.facilities).toHaveLength(4);
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
