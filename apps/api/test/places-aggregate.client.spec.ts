import { ConfigService } from '@nestjs/config';
import type { Env } from '../src/config/env';
import { PLACES_AGGREGATE_URL, PlacesAggregateClient } from '../src/places/places-aggregate.client';

const KEY = 'test-key-not-real';

const configWith = (key: string | undefined) =>
  new ConfigService({ GOOGLE_PLACES_API_KEY: key, GOOGLE_PLACES_TIMEOUT_MS: 10_000 }) as unknown as ConfigService<Env, true>;

const REQUEST = { center: { lat: -6.98, lng: 110.43 }, radiusMeters: 800, includedTypes: ['atm'], excludedTypes: ['bank'] };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const sentBody = (call: unknown[] | undefined): unknown => JSON.parse(String((call?.[1] as RequestInit).body));

describe('PlacesAggregateClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the documented computeInsights request and reads the count', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => json({ count: '12' }));

    await expect(new PlacesAggregateClient(configWith(KEY)).count(REQUEST)).resolves.toBe(12);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(PLACES_AGGREGATE_URL);
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY } });
    expect(sentBody(fetchMock.mock.calls[0])).toEqual({
      insights: ['INSIGHT_COUNT'],
      filter: {
        locationFilter: { circle: { latLng: { latitude: -6.98, longitude: 110.43 }, radius: 800 } },
        typeFilter: { includedTypes: ['atm'], excludedTypes: ['bank'] },
        operatingStatus: ['OPERATING_STATUS_OPERATIONAL'],
      },
    });
  });

  it('reads an omitted count as zero and leaves out an empty exclusion list', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => json({}));
    const client = new PlacesAggregateClient(configWith(KEY));

    await expect(client.count({ ...REQUEST, includedTypes: ['cafe'], excludedTypes: [] })).resolves.toBe(0);
    expect(sentBody(fetchMock.mock.calls[0])).toMatchObject({ filter: { typeFilter: { includedTypes: ['cafe'] } } });
    expect(JSON.stringify(sentBody(fetchMock.mock.calls[0]))).not.toContain('excludedTypes');
  });

  it("does not retry a rejected request, and reports Google's reason without the key", async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () =>
      json({ error: { code: 403, message: 'Requests to this API are blocked.', status: 'PERMISSION_DENIED' } }, 403),
    );

    const failure = new PlacesAggregateClient(configWith(KEY)).count(REQUEST);

    await expect(failure).rejects.toThrow('Google Places responded 403 PERMISSION_DENIED: Requests to this API are blocked.');
    await expect(failure).rejects.not.toThrow(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once after a rate limit', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementationOnce(async () => json({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429))
      .mockImplementation(async () => json({ count: '3' }));

    await expect(new PlacesAggregateClient(configWith(KEY)).count(REQUEST)).resolves.toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends nothing without an API key', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const client = new PlacesAggregateClient(configWith(undefined));

    expect(client.configured).toBe(false);
    await expect(client.count(REQUEST)).rejects.toThrow('GOOGLE_PLACES_API_KEY is not set');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing once cancelled', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const cancel = new AbortController();
    cancel.abort();

    await expect(new PlacesAggregateClient(configWith(KEY)).count(REQUEST, cancel.signal)).rejects.toThrow('cancelled');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
