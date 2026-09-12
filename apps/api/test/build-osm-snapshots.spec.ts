import { buildSnapshot, type RawArea } from '../scripts/build-osm-snapshots';
import { ORIGIN, area, line, node } from './fixtures';

const raw = (elements: RawArea['elements']): RawArea => ({
  id: 'unesa',
  name: 'UNESA',
  center: ORIGIN,
  radiusMeters: 3000,
  source: 'java-latest.osm.pbf',
  dataTimestamp: '2026-09-11T20:21:02Z',
  elements,
});

describe('buildSnapshot', () => {
  it('keeps the elements the POI query could return inside the circle', () => {
    const cafe = node({ amenity: 'cafe', name: 'Kopi', opening_hours: 'Mo-Su 08:00-22:00' }, 0, 1000);
    const campus = area({ amenity: 'university', name: 'UNESA' }, 200, 0);
    const far = node({ amenity: 'cafe' }, 0, 3100);
    const unmapped = node({ amenity: 'bench' }, 0, 10);

    const snapshot = buildSnapshot(raw([cafe, campus, far, unmapped]), '2026-09-12T00:00:00Z');

    expect(snapshot.pois.map((element) => `${element.type}/${element.id}`).sort()).toEqual(
      [`node/${cafe.id}`, `way/${campus.id}`].sort(),
    );
    const kept = snapshot.pois.find((element) => element.id === cafe.id);
    expect(kept?.tags).toEqual(cafe.tags);
    expect(kept?.timestamp).toBe(cafe.timestamp);
  });

  it('keeps site elements with only the tags the site conditions read', () => {
    const road = line({ highway: 'tertiary', name: 'Jl. Ketintang', surface: 'asphalt' }, [[-100, 10], [100, 10]]);
    const farRoad = line({ highway: 'tertiary' }, [[5000, 0], [5100, 0]]);
    const crossing = node({ highway: 'crossing', crossing: 'zebra' }, 10, 10);

    const snapshot = buildSnapshot(raw([road, farRoad, crossing]), '2026-09-12T00:00:00Z');

    expect(snapshot.site.map((element) => element.id).sort()).toEqual([road.id, crossing.id].sort());
    expect(snapshot.site.find((element) => element.id === road.id)?.tags).toEqual({ highway: 'tertiary' });
    expect(snapshot.site.find((element) => element.id === crossing.id)?.tags).toEqual({ highway: 'crossing' });
    expect(snapshot).toMatchObject({ version: 1, id: 'unesa', dataTimestamp: '2026-09-11T20:21:02Z' });
  });
});
