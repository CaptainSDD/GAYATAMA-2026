import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { OverturePlace } from '../src/overture/overture-place';
import { OverturePlaces, type OvertureArea } from '../src/overture/overture-places';
import { ORIGIN, offset } from './fixtures';

const at = (north: number) => {
  const { lat, lon } = offset(ORIGIN, north, 0);
  return { lat, lng: lon };
};

const place = (id: string, north: number): OverturePlace => ({ id, kind: 'copyshop', name: id, ...at(north), confidence: 0.8 });

const area = (overrides: Partial<OvertureArea> = {}): OvertureArea => ({
  version: 1,
  id: 'test-area',
  name: 'Test area',
  center: ORIGIN,
  radiusMeters: 3000,
  release: '2026-08-19.0',
  generatedAt: '2026-09-12T00:00:00Z',
  places: [place('near', 200), place('far', 2000)],
  ...overrides,
});

const silent = { log: () => undefined };

describe('OverturePlaces', () => {
  it('answers with the shops inside the circle when an area contains the whole circle', () => {
    const answer = new OverturePlaces([area()]).facilities(ORIGIN, 1600);

    expect(answer).toMatchObject({ areaId: 'test-area', release: '2026-08-19.0' });
    expect(answer?.facilities.map((facility) => facility.id)).toEqual(['overture/near']);
  });

  it('does not answer when the circle reaches beyond every area', () => {
    expect(new OverturePlaces([area()]).facilities(at(1500), 1600)).toBeNull();
  });

  describe('load', () => {
    let directory: string;

    beforeEach(() => {
      directory = mkdtempSync(join(tmpdir(), 'overture-'));
    });

    afterEach(() => {
      rmSync(directory, { recursive: true, force: true });
    });

    it('loads every area file, and treats a missing directory as no areas', () => {
      writeFileSync(join(directory, 'test-area.json.gz'), gzipSync(JSON.stringify(area())));

      expect(OverturePlaces.load(directory, silent).ids).toEqual(['test-area']);
      expect(OverturePlaces.load(join(directory, 'missing'), silent).ids).toEqual([]);
    });

    it('rejects a file that is not a valid area', () => {
      const invalid = { ...area(), places: [{ ...place('cafe', 100), kind: 'cafe' }] };
      writeFileSync(join(directory, 'bad.json.gz'), gzipSync(JSON.stringify(invalid)));

      expect(() => OverturePlaces.load(directory, silent)).toThrow('is not a version 1 Overture places file');
    });
  });
});
