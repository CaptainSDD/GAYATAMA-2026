import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../src/config/env';
import { OverpassClient } from '../src/overpass/overpass.client';

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

const PRIMARY = 'https://primary.invalid/api/interpreter';
const FALLBACK = 'https://fallback.invalid/api/interpreter';

const configWith = (fallbacks: string[]) =>
  new ConfigService({
    OVERPASS_URL: PRIMARY,
    OVERPASS_FALLBACK_URLS: fallbacks,
    OVERPASS_TIMEOUT_MS: 30_000,
    OVERPASS_TOTAL_TIMEOUT_MS: 8_000,
  }) as unknown as ConfigService<Env, true>;

const ok = () => new Response(JSON.stringify({ elements: [{ type: 'node', id: 1, lat: 0, lon: 0 }] }), { status: 200 });

const unreachable = (code: string) =>
  new TypeError('fetch failed', { cause: Object.assign(new Error('connect failed'), { code }) });

describe('OverpassClient', () => {
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

    const client = new OverpassClient(configWith([]));
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

    const client = new OverpassClient(configWith([]));
    await expect(client.query('a')).rejects.toThrow('Overpass responded 400');
    await expect(client.query('b')).rejects.toThrow('Overpass responded 400');
    await expect(client.query('c')).resolves.toEqual([]);
  });

  it('moves on to the next instance when one cannot be reached, and logs why', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      if (String(input) === PRIMARY) throw unreachable('UND_ERR_CONNECT_TIMEOUT');
      return ok();
    });

    const client = new OverpassClient(configWith([FALLBACK]));
    await expect(client.query('q')).resolves.toHaveLength(1);

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([PRIMARY, FALLBACK]);
    expect(warn).toHaveBeenCalledWith(
      'Overpass request to primary.invalid failed (UND_ERR_CONNECT_TIMEOUT); trying fallback.invalid',
    );
  });

  it('moves on to the next instance when the previous request times out', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
      .mockResolvedValueOnce(ok());

    const client = new OverpassClient(configWith([FALLBACK]));
    await expect(client.query('q')).resolves.toHaveLength(1);

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([PRIMARY, FALLBACK]);
    expect(warn).toHaveBeenCalledWith(
      'Overpass request to primary.invalid timed out; trying fallback.invalid',
    );
  });

  it('does not try other instances when the server rejected the query itself', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('bad request', { status: 400 }));
    const client = new OverpassClient(configWith([FALLBACK]));

    await expect(client.query('q')).rejects.toThrow('Overpass responded 400 (primary.invalid)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports the last failure when every instance is unreachable', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(global, 'fetch').mockRejectedValue(unreachable('ENOTFOUND'));
    const client = new OverpassClient(configWith([FALLBACK]));

    await expect(client.query('q')).rejects.toThrow('Overpass request to fallback.invalid failed (ENOTFOUND)');
  });

  it('lists the primary instance first and ignores repeated fallbacks', () => {
    const client = new OverpassClient(configWith([FALLBACK, PRIMARY, FALLBACK]));
    expect(client.endpoints).toEqual([PRIMARY, FALLBACK]);
  });
});
