import type { Facility } from '@gayatama/scoring';
import { parseOpeningHours } from '../overpass/opening-hours';
import type { OverpassElement } from '../overpass/overpass-element';
import { toFacility } from '../overpass/normalize';
import { LARGE_KINDS, categoryKind } from './categories';
import type { GeoapifyPlace } from './geoapify-place';

const OSM_TYPES = new Map<string, OverpassElement['type']>([
  ['n', 'node'],
  ['w', 'way'],
  ['r', 'relation'],
]);

/** `datasource.raw` mixes OSM tags with numbers and objects; keep the string tags. */
function stringTags(raw: Record<string, unknown> | undefined): Record<string, string> {
  const tags: Record<string, string> = {};
  if (raw === undefined) return tags;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') tags[key] = value;
  }
  return tags;
}

export function toPlaceFacility(place: GeoapifyPlace): Facility | null {
  const props = place.properties ?? {};
  const lat = props.lat ?? place.geometry?.coordinates?.[1];
  const lng = props.lon ?? place.geometry?.coordinates?.[0];
  if (lat === undefined || lng === undefined) return null;

  const raw = props.datasource?.raw;
  const tags = stringTags(raw);
  const osmType = typeof raw?.osm_type === 'string' ? OSM_TYPES.get(raw.osm_type) : undefined;
  const osmId = typeof raw?.osm_id === 'number' ? raw.osm_id : undefined;
  const osmRef = osmType !== undefined && osmId !== undefined ? { type: osmType, id: osmId } : null;

  // Geoapify serves OpenStreetMap data and passes the original tags through, so
  // the OSM normaliser is reused: kind, scale, opening hours, capacity and
  // survey dates are then derived exactly as they are for Overpass, and ids
  // stay `node/123`, interchangeable with cache entries written by Overpass.
  if (osmRef !== null) {
    const facility = toFacility({ ...osmRef, lat, lon: lng, tags });
    if (facility !== null) {
      if (facility.name === undefined && props.name !== undefined) facility.name = props.name;
      return facility;
    }
  }

  // No usable tags: fall back to Geoapify's own categories.
  const kind = categoryKind(props.categories ?? []);
  if (kind === null) return null;
  const id = osmRef !== null ? `${osmRef.type}/${osmRef.id}` : props.place_id;
  if (id === undefined) return null;

  const facility: Facility = { id, kind, lat, lng };
  const name = props.name ?? tags.name;
  if (name !== undefined) facility.name = name;
  if (LARGE_KINDS.has(kind)) facility.scale = 'large';

  const openingHours = parseOpeningHours(tags.opening_hours);
  if (openingHours !== undefined) facility.openingHours = openingHours;
  if (tags.capacity !== undefined && /^\d+$/.test(tags.capacity)) facility.capacity = Number(tags.capacity);
  if (tags.check_date !== undefined) facility.checkDate = tags.check_date;

  return facility;
}

export function toPlaceFacilities(places: readonly GeoapifyPlace[]): Facility[] {
  const facilities = new Map<string, Facility>();
  for (const place of places) {
    const facility = toPlaceFacility(place);
    if (facility !== null) facilities.set(facility.id, facility);
  }
  return [...facilities.values()];
}
