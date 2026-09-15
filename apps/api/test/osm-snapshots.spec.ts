import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { OsmSnapshots, type OsmSnapshot } from '../src/osm-snapshots/osm-snapshots';
import { matchesSiteQuery } from '../src/overpass/queries';
import { ORIGIN, line, node, offset } from './fixtures';

const snapshot = (overrides: Partial<OsmSnapshot> = {}): OsmSnapshot => ({
  version: 1,
  id: 'area',
  name: 'Test area',
  center: ORIGIN,
  radiusMeters: 3000,
  dataTimestamp: '2026-09-10T20:00:00Z',
  source: 'test',
  generatedAt: '2026-09-11T00:00:00Z',
  pois: [],
  site: [],
  ...overrides,
});

const at = (north: number, east: number) => {
  const { lat, lon } = offset(ORIGIN, north, east);
  return { lat, lng: lon };
};

describe('OsmSnapshots', () => {
  it('answers only when the whole query circle lies inside the snapshot', () => {
    const snapshots = new OsmSnapshots([snapshot()]);
    expect(snapshots.pois(ORIGIN, 1608)).not.toBeNull();
    expect(snapshots.pois(at(1300, 0), 1608)).not.toBeNull();
    expect(snapshots.pois(at(1500, 0), 1608)).toBeNull();
    expect(snapshots.site(at(1400, 0))).not.toBeNull();
    expect(snapshots.site(at(1600, 0))).toBeNull();
  });

  it('returns the POIs inside the query radius, as Overpass would', () => {
    const inside = node({ amenity: 'cafe' }, 1000, 0);
    const outside = node({ amenity: 'cafe' }, 1700, 0);
    const answer = new OsmSnapshots([snapshot({ pois: [inside, outside] })]).pois(ORIGIN, 1608);
    expect(answer).toEqual({ snapshotId: 'area', dataTimestamp: '2026-09-10T20:00:00Z', elements: [inside] });
  });
});

describe('matchesSiteQuery', () => {
  const road = (east: number) => line({ highway: 'residential' }, [[-100, east], [100, east]]);

  it('applies each line of the site query with its own radius', () => {
    expect(matchesSiteQuery(road(40), ORIGIN)).toBe(true);
    expect(matchesSiteQuery(road(60), ORIGIN)).toBe(false);
    expect(matchesSiteQuery(line({ waterway: 'river' }, [[-500, 250], [500, 250]]), ORIGIN)).toBe(true);
    expect(matchesSiteQuery(line({ landuse: 'industrial' }, [[-50, 150], [50, 150]]), ORIGIN)).toBe(false);
    expect(matchesSiteQuery(line({ highway: 'footway' }, [[-10, 280], [10, 280]]), ORIGIN)).toBe(true);
    expect(matchesSiteQuery(node({ highway: 'crossing' }, 0, 290), ORIGIN)).toBe(true);
    // Beyond the walkability radius, crossings are still retained as mapped
    // passages for access-barrier analysis.
    expect(matchesSiteQuery(node({ highway: 'crossing' }, 0, 310), ORIGIN)).toBe(true);
    expect(matchesSiteQuery(line({ highway: 'primary' }, [[-10, 1400], [10, 1400]]), ORIGIN)).toBe(true);
    expect(matchesSiteQuery(line({ highway: 'primary' }, [[-10, 1600], [10, 1600]]), ORIGIN)).toBe(false);
    expect(matchesSiteQuery(line({ building: 'yes' }, [[0, 0], [10, 10]]), ORIGIN)).toBe(false);
  });

  it('uses the widest matching line for elements with two roles', () => {
    // Too far to be the site's road (50 m), close enough to count as a sidewalk (300 m).
    const street = line({ highway: 'residential', sidewalk: 'both' }, [[-100, 100], [100, 100]]);
    expect(matchesSiteQuery(street, ORIGIN)).toBe(true);
  });
});

describe('OsmSnapshots.load', () => {
  const directories: string[] = [];
  const logger = { log: jest.fn() };
  const temporaryDirectory = () => {
    const directory = mkdtempSync(join(tmpdir(), 'gayatama-snapshots-'));
    directories.push(directory);
    return directory;
  };

  afterAll(() => {
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  });

  it('loads gzipped snapshots and ignores other files', () => {
    const directory = temporaryDirectory();
    writeFileSync(join(directory, 'area.json.gz'), gzipSync(JSON.stringify(snapshot())));
    writeFileSync(join(directory, 'README.md'), 'notes');
    expect(OsmSnapshots.load(directory, logger).ids).toEqual(['area']);
  });

  it('treats a missing directory as having no snapshots', () => {
    expect(OsmSnapshots.load(join(tmpdir(), 'gayatama-no-such-directory'), logger).ids).toEqual([]);
  });

  it('refuses a file that is not a snapshot', () => {
    const directory = temporaryDirectory();
    writeFileSync(join(directory, 'bad.json.gz'), gzipSync(JSON.stringify({ version: 2 })));
    expect(() => OsmSnapshots.load(directory, logger)).toThrow('is not a version 1 OSM snapshot');
  });
});
