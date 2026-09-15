import { AMENITY_KINDS, SHOP_KINDS } from '../src/overpass/normalize';
import { buildPoiQuery, buildSiteQuery } from '../src/overpass/queries';
import { ORIGIN } from './fixtures';

describe('buildPoiQuery', () => {
  const query = buildPoiQuery(ORIGIN, 1607.4, 25);

  it('requests every mapped amenity and shop value', () => {
    for (const value of [...AMENITY_KINDS.keys(), ...SHOP_KINDS.keys()]) {
      expect(query).toMatch(new RegExp(`[(|]${value}[|)]`));
    }
  });

  it('rounds the radius up, sets the server timeout, and asks for centres and edit metadata', () => {
    expect(query.startsWith('[out:json][timeout:25];')).toBe(true);
    expect(query).toContain('(around:1608,-7.3145000,112.7263000)');
    expect(query.trimEnd().endsWith('out center meta;')).toBe(true);
  });

  it('does not fetch individual house footprints', () => {
    expect(query).not.toContain('residential)');
    expect(query).toContain('[landuse=residential]');
  });
});

describe('buildSiteQuery', () => {
  it('queries site conditions plus mapped access barriers and returns geometry', () => {
    const query = buildSiteQuery(ORIGIN, 25);
    expect(query).toContain('way(around:50,-7.3145000,112.7263000)[highway~"^(motorway|');
    expect(query).toContain('living_street');
    expect(query).toContain('way(around:1500,-7.3145000,112.7263000)[railway~"^(rail)$"]');
    expect(query).toContain('way(around:1500,-7.3145000,112.7263000)[waterway~"^(river|canal)$"]');
    expect(query).toContain('node(around:1500,-7.3145000,112.7263000)[railway~"^(crossing|level_crossing)$"]');
    expect(query).toContain('[highway][bridge]');
    expect(query.trimEnd().endsWith('out geom;')).toBe(true);
  });
});
