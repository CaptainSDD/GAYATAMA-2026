import type { LatLng, RoadClass, SiteConditions } from '@gayatama/scoring';
import type { OverpassElement } from './overpass-element';

export const ROAD_CLASSES = new Map<string, RoadClass>([
  ['motorway', 'primary'],
  ['motorway_link', 'primary'],
  ['trunk', 'primary'],
  ['trunk_link', 'primary'],
  ['primary', 'primary'],
  ['primary_link', 'primary'],
  ['secondary', 'secondary'],
  ['secondary_link', 'secondary'],
  ['tertiary', 'tertiary'],
  ['tertiary_link', 'tertiary'],
  ['unclassified', 'residential'],
  ['residential', 'residential'],
  ['living_street', 'residential'],
  ['service', 'service'],
]);

export const WATERWAYS = ['river', 'canal', 'stream'];
export const PEDESTRIAN_WAYS = ['footway', 'pedestrian', 'path'];
export const SIDEWALK_VALUES = ['both', 'left', 'right', 'yes', 'separate'];

export const SITE_RADII_METERS = { road: 50, waterway: 300, industrial: 100, pedestrian: 300 } as const;

const METERS_PER_DEGREE = (6_371_008.8 * Math.PI) / 180;

/** Shortest distance from a point to a node or polyline, in a local flat projection. */
export function distanceToGeometryMeters(point: LatLng, geometry: readonly { lat: number; lon: number }[]): number {
  const cosLat = Math.cos((point.lat * Math.PI) / 180);
  const project = (p: { lat: number; lon: number }) => ({
    x: (p.lon - point.lng) * cosLat * METERS_PER_DEGREE,
    y: (p.lat - point.lat) * METERS_PER_DEGREE,
  });

  const first = geometry[0];
  if (first === undefined) return Number.POSITIVE_INFINITY;
  if (geometry.length === 1) {
    const p = project(first);
    return Math.hypot(p.x, p.y);
  }

  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < geometry.length; i += 1) {
    const a = project(geometry[i - 1]!);
    const b = project(geometry[i]!);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, -(a.x * dx + a.y * dy) / lengthSquared));
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return best;
}

function geometryOf(element: OverpassElement): { lat: number; lon: number }[] {
  if (element.type === 'node') {
    return element.lat === undefined || element.lon === undefined ? [] : [{ lat: element.lat, lon: element.lon }];
  }
  return element.geometry ?? [];
}

export function siteConditions(elements: readonly OverpassElement[], point: LatLng): SiteConditions {
  const site: SiteConditions = {};
  let nearestRoad = Number.POSITIVE_INFINITY;
  let nearestWaterway = Number.POSITIVE_INFINITY;
  let pedestrianFeatureCount = 0;

  for (const element of elements) {
    const tags = element.tags ?? {};

    if (element.type === 'way') {
      const roadClass = tags.highway === undefined ? undefined : ROAD_CLASSES.get(tags.highway);
      if (roadClass !== undefined) {
        const distance = distanceToGeometryMeters(point, geometryOf(element));
        if (distance <= SITE_RADII_METERS.road && distance < nearestRoad) {
          nearestRoad = distance;
          site.roadClass = roadClass;
        }
      }
      if (tags.waterway !== undefined && WATERWAYS.includes(tags.waterway)) {
        nearestWaterway = Math.min(nearestWaterway, distanceToGeometryMeters(point, geometryOf(element)));
      }
      if (tags.landuse === 'industrial') site.industrialLanduseNearby = true;
      if (
        (tags.highway !== undefined && PEDESTRIAN_WAYS.includes(tags.highway)) ||
        (tags.sidewalk !== undefined && SIDEWALK_VALUES.includes(tags.sidewalk))
      ) {
        pedestrianFeatureCount += 1;
      }
    } else if (element.type === 'node' && tags.highway === 'crossing') {
      pedestrianFeatureCount += 1;
    }
  }

  if (nearestWaterway <= SITE_RADII_METERS.waterway) site.nearestWaterwayMeters = nearestWaterway;
  site.pedestrianFeatureCount = pedestrianFeatureCount;
  return site;
}
