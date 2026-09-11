import type { Facility, FacilityKind } from '@gayatama/scoring';
import { parseOpeningHours } from './opening-hours';
import type { OverpassElement } from './overpass-element';

// OpenStreetMap tags → engine facility kinds. The Overpass query is built from
// these same tables, so a tag cannot be fetched without being mapped, or mapped
// without being fetched. See docs/data-sources.md#tag-mapping.

export const AMENITY_KINDS = new Map<string, FacilityKind>([
  ['university', 'campus'],
  ['college', 'campus'],
  ['school', 'school'],
  ['hospital', 'hospital'],
  ['cafe', 'cafe'],
  ['restaurant', 'restaurant'],
  ['fast_food', 'fast_food'],
  ['food_court', 'food_court'],
  ['pharmacy', 'pharmacy'],
  ['atm', 'atm'],
  ['bank', 'bank'],
  ['marketplace', 'marketplace'],
  ['place_of_worship', 'place_of_worship'],
  ['clinic', 'clinic'],
  ['doctors', 'clinic'],
  ['bus_station', 'transit'],
  ['parking', 'parking'],
  ['townhall', 'government_office'],
]);

export const SHOP_KINDS = new Map<string, FacilityKind>([
  ['mall', 'mall'],
  ['department_store', 'mall'],
  ['laundry', 'laundry'],
  ['dry_cleaning', 'dry_cleaning'],
  ['copyshop', 'copyshop'],
  ['stationery', 'stationery_shop'],
  ['convenience', 'convenience'],
  ['supermarket', 'supermarket'],
  ['hairdresser', 'hairdresser'],
  ['beauty', 'beauty'],
  ['chemist', 'chemist'],
]);

export const BUILDING_KINDS = new Map<string, FacilityKind>([
  ['office', 'office'],
  ['apartments', 'housing'],
  ['dormitory', 'boarding_house'],
]);

export const TOURISM_KINDS = new Map<string, FacilityKind>([
  ['guest_house', 'boarding_house'],
  ['hostel', 'boarding_house'],
]);

const SURVEY_DATE_TAGS = ['check_date', 'survey:date', 'check_date:opening_hours'];
const COFFEE_DRINK_VALUES = new Set(['yes', 'served']);

function values(tag: string | undefined): string[] {
  return tag === undefined ? [] : tag.split(';').map((value) => value.trim()).filter((value) => value !== '');
}

export function facilityKind(tags: Record<string, string>): FacilityKind | null {
  const amenity = tags.amenity;
  if ((amenity === 'cafe' || amenity === 'fast_food') && values(tags.cuisine).includes('bubble_tea')) {
    return 'bubble_tea';
  }
  const byAmenity = amenity === undefined ? undefined : AMENITY_KINDS.get(amenity);
  if (byAmenity !== undefined) return byAmenity;

  const byShop = tags.shop === undefined ? undefined : SHOP_KINDS.get(tags.shop);
  if (byShop !== undefined) return byShop;

  if (tags.craft === 'printer') return 'printer';
  if (tags.highway === 'bus_stop' || tags.railway === 'station' || tags.public_transport === 'station') return 'transit';
  if (tags.office === 'government') return 'government_office';
  if (tags.office !== undefined && tags.office !== 'no') return 'office';

  const byBuilding = tags.building === undefined ? undefined : BUILDING_KINDS.get(tags.building);
  if (byBuilding !== undefined) return byBuilding;

  const byTourism = tags.tourism === undefined ? undefined : TOURISM_KINDS.get(tags.tourism);
  if (byTourism !== undefined) return byTourism;

  if (tags.landuse === 'residential') return 'housing';
  return null;
}

/** Large only where the tags themselves justify it. */
function isLarge(tags: Record<string, string>): boolean {
  return (
    tags.amenity === 'university' ||
    tags.amenity === 'hospital' ||
    tags.shop === 'mall' ||
    tags.shop === 'department_store' ||
    tags.railway === 'station'
  );
}

/** The most recent valid survey date among the survey tags. */
function surveyDate(tags: Record<string, string>): string | undefined {
  let latest: { value: string; time: number } | undefined;
  for (const key of SURVEY_DATE_TAGS) {
    const value = tags[key];
    if (value === undefined) continue;
    const time = Date.parse(value);
    if (Number.isNaN(time)) continue;
    if (latest === undefined || time > latest.time) latest = { value, time };
  }
  return latest?.value;
}

export function toFacility(element: OverpassElement): Facility | null {
  const tags = element.tags ?? {};
  const kind = facilityKind(tags);
  if (kind === null) return null;

  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  const facility: Facility = { id: `${element.type}/${element.id}`, kind, lat, lng };

  if (tags.name !== undefined) facility.name = tags.name;
  if (isLarge(tags)) facility.scale = 'large';

  const checkDate = surveyDate(tags);
  if (checkDate !== undefined) facility.checkDate = checkDate;
  if (element.timestamp !== undefined) facility.lastEditDate = element.timestamp;

  const openingHours = parseOpeningHours(tags.opening_hours);
  if (openingHours !== undefined) facility.openingHours = openingHours;

  if (tags.capacity !== undefined && /^\d+$/.test(tags.capacity)) facility.capacity = Number(tags.capacity);

  const servesCoffee =
    COFFEE_DRINK_VALUES.has(tags['drink:coffee'] ?? '') || values(tags.cuisine).includes('coffee_shop');
  if ((kind === 'restaurant' || kind === 'fast_food') && servesCoffee) facility.servesCoffee = true;

  return facility;
}

export function toFacilities(elements: readonly OverpassElement[]): Facility[] {
  const facilities = new Map<string, Facility>();
  for (const element of elements) {
    const facility = toFacility(element);
    if (facility !== null) facilities.set(facility.id, facility);
  }
  return [...facilities.values()];
}
