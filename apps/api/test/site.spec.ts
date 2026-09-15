import { distanceToGeometryMeters, siteConditions } from '../src/overpass/site';
import { ORIGIN, line, node, offset, siteElements } from './fixtures';

describe('distanceToGeometryMeters', () => {
  it('measures to a node', () => {
    expect(distanceToGeometryMeters(ORIGIN, [offset(ORIGIN, 100, 0)])).toBeCloseTo(100, 0);
  });

  it('measures perpendicular distance to a line', () => {
    const geometry = [offset(ORIGIN, -100, -20), offset(ORIGIN, 100, -20)];
    expect(distanceToGeometryMeters(ORIGIN, geometry)).toBeCloseTo(20, 0);
  });

  it('measures to the nearest end when the perpendicular falls outside the segment', () => {
    const geometry = [offset(ORIGIN, 100, 50), offset(ORIGIN, 200, 50)];
    expect(distanceToGeometryMeters(ORIGIN, geometry)).toBeCloseTo(Math.hypot(100, 50), 0);
  });

  it('is infinite for empty geometry', () => {
    expect(distanceToGeometryMeters(ORIGIN, [])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('siteConditions', () => {
  it('takes the class of the nearest road and counts pedestrian features', () => {
    expect(siteConditions(siteElements(), ORIGIN)).toEqual({ roadClass: 'service', pedestrianFeatureCount: 2 });
  });

  it('ignores roads farther than 50 m', () => {
    const far = line({ highway: 'primary' }, [[-100, 80], [100, 80]]);
    expect(siteConditions([far], ORIGIN).roadClass).toBeUndefined();
  });

  it('reports the nearest waterway within 300 m and nearby industrial land use', () => {
    const river = line({ waterway: 'river' }, [[-500, 80], [500, 80]]);
    const industrial = line({ landuse: 'industrial' }, [[60, 0], [60, 60], [120, 60], [60, 0]]);
    const site = siteConditions([river, industrial], ORIGIN);
    expect(site.nearestWaterwayMeters).toBeCloseTo(80, 0);
    expect(site.industrialLanduseNearby).toBe(true);
  });

  it('leaves the waterway distance unset beyond 300 m', () => {
    const river = line({ waterway: 'canal' }, [[-500, 400], [500, 400]]);
    expect(siteConditions([river], ORIGIN).nearestWaterwayMeters).toBeUndefined();
  });

  it('counts crossings as pedestrian features', () => {
    expect(siteConditions([node({ highway: 'crossing' }, 10, 10)], ORIGIN).pedestrianFeatureCount).toBe(1);
  });

  it('does not count access-query crossings beyond the 300 m walkability radius', () => {
    expect(siteConditions([node({ highway: 'crossing' }, 400, 0)], ORIGIN).pedestrianFeatureCount).toBe(0);
  });
});
