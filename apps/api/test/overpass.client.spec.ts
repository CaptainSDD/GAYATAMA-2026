import { ConfigService } from '@nestjs/config';
import type { Env } from '../src/config/env';
import { OverpassClient } from '../src/overpass/overpass.client';

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('OverpassClient', () => {
  const config = new ConfigService({
    OVERPASS_URL: 'https://overpass.invalid/api/interpreter',
    OVERPASS_TIMEOUT_MS: 30_000,
  }) as unknown as ConfigService<Env, true>;

  afterEach(() => jest.restoreAllMocks());

  it('runs at most two queries at a time, the number of slots Overpass allows', async () => {
    let active = 0;
    let peak = 0;
    const inFlight: (() => void)[] = [];
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          active += 1;
          peak = Math.max(peak, active);
          inFlight.push(() => {
            active -= 1;
            resolve(new Response(JSON.stringify({ elements: [] }), { status: 200 }));
          });
        }),
    );

    const client = new OverpassClient(config);
    const queries = Array.from({ length: 5 }, (_, index) => client.query(`query ${index}`));

    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    while (inFlight.length > 0) {
      inFlight.shift()?.();
      await settle();
      expect(active).toBeLessThanOrEqual(2);
    }

    await expect(Promise.all(queries)).resolves.toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(peak).toBe(2);
  });

  it('frees the slot when a query fails', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('bad request', { status: 400 }))
      .mockResolvedValueOnce(new Response('bad request', { status: 400 }))
      .mockResolvedValue(new Response(JSON.stringify({ elements: [] }), { status: 200 }));

    const client = new OverpassClient(config);
    await expect(client.query('a')).rejects.toThrow('Overpass responded 400');
    await expect(client.query('b')).rejects.toThrow('Overpass responded 400');
    await expect(client.query('c')).resolves.toEqual([]);
  });
});
