import type { LatLng } from '@gayatama/scoring';
import { AMENITY_KINDS, BUILDING_KINDS, SHOP_KINDS, TOURISM_KINDS } from './normalize';
import type { OverpassElement } from './overpass-element';
import {
  DISCOURAGING_AMENITY,
  DISCOURAGING_LANDUSE,
  PEDESTRIAN_WAYS,
  ROAD_CLASSES,
  SIDEWALK_VALUES,
  SITE_RADII_METERS,
  WATERWAYS,
  discouragingKind,
  discouragingRadiusMeters,
  distanceToGeometryMeters,
} from './site';

const exact = (values: Iterable<string>): string => `"^(${[...values].join('|')})$"`;

const POI_FILTERS = [
  `[amenity~${exact(AMENITY_KINDS.keys())}]`,
  `[shop~${exact(SHOP_KINDS.keys())}]`,
  `[building~${exact(BUILDING_KINDS.keys())}]`,
  `[tourism~${exact(TOURISM_KINDS.keys())}]`,
  '[office]',
  '[highway=bus_stop]',
  '[railway=station]',
  '[public_transport=station]',
  '[craft=printer]',
  '[landuse=residential]',
];

const around = (point: LatLng, radiusMeters: number): string =>
  `(around:${Math.ceil(radiusMeters)},${point.lat.toFixed(7)},${point.lng.toFixed(7)})`;

/** Every facility kind the engine uses, with centre points for areas and edit metadata. */
export function buildPoiQuery(center: LatLng, radiusMeters: number, timeoutSeconds: number): string {
  const area = around(center, radiusMeters);
  return [
    `[out:json][timeout:${timeoutSeconds}];`,
    '(',
    ...POI_FILTERS.map((filter) => `  nwr${area}${filter};`),
    ');',
    'out center meta;',
  ].join('\n');
}

/** Road, waterway, land use and pedestrian features at the candidate site. */
export function buildSiteQuery(point: LatLng, timeoutSeconds: number, paddingMeters = 0): string {
  const radius = (meters: number) => meters + paddingMeters;
  return [
    `[out:json][timeout:${timeoutSeconds}];`,
    '(',
    `  way${around(point, radius(SITE_RADII_METERS.road))}[highway~${exact(ROAD_CLASSES.keys())}];`,
    `  way${around(point, radius(SITE_RADII_METERS.waterway))}[waterway~${exact(WATERWAYS)}];`,
    `  way${around(point, radius(SITE_RADII_METERS.industrial))}[landuse=industrial];`,
    `  way${around(point, radius(SITE_RADII_METERS.pedestrian))}[highway~${exact(PEDESTRIAN_WAYS)}];`,
    `  way${around(point, radius(SITE_RADII_METERS.pedestrian))}[sidewalk~${exact(SIDEWALK_VALUES)}];`,
    `  node${around(point, radius(SITE_RADII_METERS.pedestrian))}[highway=crossing];`,
    `  nwr${around(point, radius(SITE_RADII_METERS.nuisance))}[landuse~${exact(DISCOURAGING_LANDUSE.keys())}];`,
    `  nwr${around(point, radius(SITE_RADII_METERS.nuisance))}[amenity~${exact(DISCOURAGING_AMENITY.keys())}];`,
    ');',
    'out geom;',
  ].join('\n');
}

interface SiteQueryRule {
  /** `any` for the `nwr` lines, which take nodes, ways and relations alike. */
  type: 'node' | 'way' | 'any';
  radiusMeters: number;
  matches: (tags: Record<string, string>) => boolean;
}

/** buildSiteQuery, line by line, as predicates. The two must change together. */
const SITE_QUERY_RULES: readonly SiteQueryRule[] = [
  { type: 'way', radiusMeters: SITE_RADII_METERS.road, matches: (tags) => ROAD_CLASSES.has(tags.highway ?? '') },
  { type: 'way', radiusMeters: SITE_RADII_METERS.waterway, matches: (tags) => WATERWAYS.includes(tags.waterway ?? '') },
  { type: 'way', radiusMeters: SITE_RADII_METERS.industrial, matches: (tags) => tags.landuse === 'industrial' },
  {
    type: 'way',
    radiusMeters: SITE_RADII_METERS.pedestrian,
    matches: (tags) => PEDESTRIAN_WAYS.includes(tags.highway ?? ''),
  },
  {
    type: 'way',
    radiusMeters: SITE_RADII_METERS.pedestrian,
    matches: (tags) => SIDEWALK_VALUES.includes(tags.sidewalk ?? ''),
  },
  { type: 'node', radiusMeters: SITE_RADII_METERS.pedestrian, matches: (tags) => tags.highway === 'crossing' },
  // The query fetches every discouraging neighbour within the widest radius; a
  // cemetery is then judged at its own, closer one.
  { type: 'any', radiusMeters: SITE_RADII_METERS.nuisance, matches: (tags) => discouragingKind(tags) !== undefined },
];

/** The radius that decides whether a fetched element counts, which for a cemetery is closer than the query's. */
function ruleRadius(rule: SiteQueryRule, tags: Record<string, string>): number {
  const kind = discouragingKind(tags);
  return rule.type === 'any' && kind !== undefined ? discouragingRadiusMeters(kind) : rule.radiusMeters;
}

function appliesTo(rule: SiteQueryRule, type: OverpassElement['type']): boolean {
  return rule.type === 'any' || rule.type === type;
}

/** The largest radius any line of the site query uses. */
export const MAX_SITE_QUERY_RADIUS_METERS = Math.max(...SITE_QUERY_RULES.map((rule) => rule.radiusMeters));

/** A node's position, or a way's geometry. */
export function elementGeometry(element: OverpassElement): { lat: number; lon: number }[] {
  if (element.type === 'node') {
    return element.lat === undefined || element.lon === undefined ? [] : [{ lat: element.lat, lon: element.lon }];
  }
  return element.geometry ?? [];
}

/** Whether an element's type and tags match any line of the site query, regardless of distance. */
export function isSiteQueryCandidate(element: OverpassElement): boolean {
  const tags = element.tags ?? {};
  return SITE_QUERY_RULES.some((rule) => appliesTo(rule, element.type) && rule.matches(tags));
}

/** Whether Overpass would return `element` for buildSiteQuery(point). */
export function matchesSiteQuery(element: OverpassElement, point: LatLng): boolean {
  const tags = element.tags ?? {};
  const rules = SITE_QUERY_RULES.filter((rule) => appliesTo(rule, element.type) && rule.matches(tags));
  if (rules.length === 0) return false;
  const distance = distanceToGeometryMeters(point, elementGeometry(element));
  return rules.some((rule) => distance <= ruleRadius(rule, tags));
}
