import type { LatLng } from '@gayatama/scoring';
import { AMENITY_KINDS, BUILDING_KINDS, SHOP_KINDS, TOURISM_KINDS } from './normalize';
import { PEDESTRIAN_WAYS, ROAD_CLASSES, SIDEWALK_VALUES, SITE_RADII_METERS, WATERWAYS } from './site';

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
export function buildSiteQuery(point: LatLng, timeoutSeconds: number): string {
  return [
    `[out:json][timeout:${timeoutSeconds}];`,
    '(',
    `  way${around(point, SITE_RADII_METERS.road)}[highway~${exact(ROAD_CLASSES.keys())}];`,
    `  way${around(point, SITE_RADII_METERS.waterway)}[waterway~${exact(WATERWAYS)}];`,
    `  way${around(point, SITE_RADII_METERS.industrial)}[landuse=industrial];`,
    `  way${around(point, SITE_RADII_METERS.pedestrian)}[highway~${exact(PEDESTRIAN_WAYS)}];`,
    `  way${around(point, SITE_RADII_METERS.pedestrian)}[sidewalk~${exact(SIDEWALK_VALUES)}];`,
    `  node${around(point, SITE_RADII_METERS.pedestrian)}[highway=crossing];`,
    ');',
    'out geom;',
  ].join('\n');
}
