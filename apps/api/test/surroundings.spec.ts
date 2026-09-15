import { buildSiteQuery, isSiteQueryCandidate, matchesSiteQuery } from '../src/overpass/queries';
import { siteConditions } from '../src/overpass/site';
import { ORIGIN, line, node } from './fixtures';

/** A cemetery boundary running east to west, `north` metres away. */
const cemeteryAt = (north: number) => line({ landuse: 'cemetery' }, [[north, -20], [north, 20]]);

describe('discouraging surroundings', () => {
  it('reports a cemetery within 150 m, and ignores one further away', () => {
    expect(siteConditions([cemeteryAt(100)], ORIGIN).discouragingSurroundings).toEqual(['cemetery']);
    expect(siteConditions([cemeteryAt(200)], ORIGIN).discouragingSurroundings).toBeUndefined();
  });

  it('reports waste, quarry, military and prison neighbours within 300 m', () => {
    const elements = [
      node({ amenity: 'waste_transfer_station' }, 250, 0),
      line({ landuse: 'quarry' }, [[280, -10], [280, 10]]),
      node({ amenity: 'prison' }, 400, 0),
    ];
    expect(siteConditions(elements, ORIGIN).discouragingSurroundings).toEqual(['quarry', 'waste']);
  });

  it('says nothing when the neighbourhood holds none of them', () => {
    expect(siteConditions([node({ amenity: 'cafe' }, 50, 0)], ORIGIN).discouragingSurroundings).toBeUndefined();
  });

  it('fetches them in the site query, at the widest radius', () => {
    const query = buildSiteQuery(ORIGIN, 25);
    expect(query).toContain('[landuse~"^(cemetery|landfill|quarry|military)$"]');
    expect(query).toContain('[amenity~"^(grave_yard|waste_transfer_station|prison)$"]');
    expect(query).toContain('(around:300,');
  });

  it('replays the query rules for snapshots, at each kind own radius', () => {
    expect(isSiteQueryCandidate(cemeteryAt(100))).toBe(true);
    expect(matchesSiteQuery(cemeteryAt(100), ORIGIN)).toBe(true);
    expect(matchesSiteQuery(cemeteryAt(200), ORIGIN)).toBe(false);
    expect(matchesSiteQuery(node({ amenity: 'prison' }, 250, 0), ORIGIN)).toBe(true);
    expect(matchesSiteQuery(node({ amenity: 'prison' }, 350, 0), ORIGIN)).toBe(false);
  });
});
