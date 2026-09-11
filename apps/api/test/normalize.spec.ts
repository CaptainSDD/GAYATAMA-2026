import { facilityKind, toFacilities, toFacility } from '../src/overpass/normalize';
import type { OverpassElement } from '../src/overpass/overpass-element';

describe('facilityKind', () => {
  it.each([
    [{ amenity: 'university' }, 'campus'],
    [{ amenity: 'cafe' }, 'cafe'],
    [{ amenity: 'cafe', cuisine: 'bubble_tea' }, 'bubble_tea'],
    [{ amenity: 'fast_food', cuisine: 'burger;bubble_tea' }, 'bubble_tea'],
    [{ amenity: 'doctors' }, 'clinic'],
    [{ amenity: 'townhall' }, 'government_office'],
    [{ shop: 'stationery' }, 'stationery_shop'],
    [{ shop: 'department_store' }, 'mall'],
    [{ craft: 'printer' }, 'printer'],
    [{ highway: 'bus_stop' }, 'transit'],
    [{ railway: 'station' }, 'transit'],
    [{ office: 'government' }, 'government_office'],
    [{ office: 'company' }, 'office'],
    [{ building: 'apartments' }, 'housing'],
    [{ building: 'dormitory' }, 'boarding_house'],
    [{ tourism: 'hostel' }, 'boarding_house'],
    [{ landuse: 'residential' }, 'housing'],
  ])('maps %j to %s', (tags, kind) => {
    expect(facilityKind(tags)).toBe(kind);
  });

  it.each([[{}], [{ office: 'no' }], [{ shop: 'beverages' }], [{ amenity: 'constructor' }], [{ building: 'residential' }]])(
    'ignores %j',
    (tags) => {
      expect(facilityKind(tags)).toBeNull();
    },
  );
});

describe('toFacility', () => {
  const university: OverpassElement = {
    type: 'node',
    id: 42,
    lat: -7.31,
    lon: 112.72,
    timestamp: '2026-05-01T10:00:00Z',
    tags: { amenity: 'university', name: 'UNESA', check_date: '2025-01-01', 'survey:date': '2026-02-01' },
  };

  it('builds an engine facility with the latest survey date and edit date', () => {
    expect(toFacility(university)).toEqual({
      id: 'node/42',
      kind: 'campus',
      lat: -7.31,
      lng: 112.72,
      name: 'UNESA',
      scale: 'large',
      checkDate: '2026-02-01',
      lastEditDate: '2026-05-01T10:00:00Z',
    });
  });

  it('uses the centre of ways and relations', () => {
    const housing = toFacility({ type: 'way', id: 7, center: { lat: -7.3, lon: 112.7 }, tags: { landuse: 'residential' } });
    expect(housing).toMatchObject({ id: 'way/7', kind: 'housing', lat: -7.3, lng: 112.7 });
  });

  it('skips elements without coordinates or a mapped kind', () => {
    expect(toFacility({ type: 'way', id: 1, tags: { amenity: 'school' } })).toBeNull();
    expect(toFacility({ type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'bench' } })).toBeNull();
  });

  it('ignores invalid survey dates', () => {
    const facility = toFacility({ type: 'node', id: 3, lat: 0, lon: 0, tags: { amenity: 'school', check_date: 'last year' } });
    expect(facility?.checkDate).toBeUndefined();
  });

  it('parses opening hours and numeric capacity', () => {
    const cafe = toFacility({ type: 'node', id: 4, lat: 0, lon: 0, tags: { amenity: 'cafe', opening_hours: 'Mo-Fr 08:00-17:00' } });
    expect(cafe?.openingHours).toHaveLength(5);
    expect(toFacility({ type: 'node', id: 5, lat: 0, lon: 0, tags: { amenity: 'parking', capacity: '40' } })?.capacity).toBe(40);
    expect(toFacility({ type: 'node', id: 6, lat: 0, lon: 0, tags: { amenity: 'parking', capacity: 'about 40' } })?.capacity).toBeUndefined();
  });

  it('flags restaurants that serve coffee, and only restaurants or fast food', () => {
    expect(toFacility({ type: 'node', id: 8, lat: 0, lon: 0, tags: { amenity: 'restaurant', 'drink:coffee': 'yes' } })?.servesCoffee).toBe(true);
    expect(toFacility({ type: 'node', id: 9, lat: 0, lon: 0, tags: { amenity: 'restaurant' } })?.servesCoffee).toBeUndefined();
    expect(toFacility({ type: 'node', id: 10, lat: 0, lon: 0, tags: { amenity: 'cafe', 'drink:coffee': 'yes' } })?.servesCoffee).toBeUndefined();
  });
});

describe('toFacilities', () => {
  it('drops unmapped elements and duplicates', () => {
    const school: OverpassElement = { type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'school' } };
    const bench: OverpassElement = { type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'bench' } };
    expect(toFacilities([school, bench, school]).map((facility) => facility.id)).toEqual(['node/1']);
  });
});
