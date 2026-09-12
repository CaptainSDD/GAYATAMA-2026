import type { FacilityKind, FacilityScale } from '@gayatama/scoring';

// Google place types → engine facility kinds, for the Places Aggregate API.
// Filters accept only the types in Table A of Google's place types list. Types
// excluded from one query are the ones counted by another, so a place carrying
// both is counted once. Photocopy, print and stationery shops have no Table A
// type, so those kinds, like housing and parking, stay with OpenStreetMap.
// See docs/data-sources.md.

export const GOOGLE_PLACES_SOURCE = 'google';

export interface PlaceCountQuery {
  kind: FacilityKind;
  includedTypes: readonly string[];
  excludedTypes?: readonly string[];
  /** Defaults to `medium`, as for OpenStreetMap facilities. */
  scale?: FacilityScale;
}

const RAIL_STATIONS = ['train_station', 'light_rail_station', 'subway_station'];

export const PLACE_COUNT_QUERIES: readonly PlaceCountQuery[] = [
  // Facilities that indicate customer segments
  { kind: 'campus', includedTypes: ['university'], scale: 'large' },
  { kind: 'school', includedTypes: ['school', 'primary_school', 'secondary_school'], excludedTypes: ['university'] },
  { kind: 'office', includedTypes: ['corporate_office', 'business_center', 'coworking_space'] },
  { kind: 'government_office', includedTypes: ['city_hall', 'local_government_office', 'government_office'] },
  { kind: 'transit', includedTypes: RAIL_STATIONS, scale: 'large' },
  {
    kind: 'transit',
    includedTypes: ['bus_station', 'bus_stop', 'transit_station', 'transit_stop'],
    excludedTypes: RAIL_STATIONS,
  },
  { kind: 'hospital', includedTypes: ['hospital'], scale: 'large' },
  { kind: 'mall', includedTypes: ['shopping_mall', 'department_store'], scale: 'large' },
  // Businesses that compete with one or more categories
  { kind: 'cafe', includedTypes: ['cafe', 'coffee_shop', 'coffee_stand'] },
  { kind: 'bubble_tea', includedTypes: ['tea_house', 'juice_shop'], excludedTypes: ['cafe', 'coffee_shop', 'coffee_stand'] },
  {
    kind: 'restaurant',
    includedTypes: ['restaurant'],
    excludedTypes: ['cafe', 'coffee_shop', 'fast_food_restaurant', 'food_court'],
  },
  { kind: 'fast_food', includedTypes: ['fast_food_restaurant'], excludedTypes: ['food_court'] },
  { kind: 'food_court', includedTypes: ['food_court'] },
  { kind: 'laundry', includedTypes: ['laundry'] },
  { kind: 'convenience', includedTypes: ['convenience_store', 'grocery_store'], excludedTypes: ['supermarket'] },
  { kind: 'supermarket', includedTypes: ['supermarket'] },
  { kind: 'hairdresser', includedTypes: ['hair_salon', 'barber_shop'] },
  { kind: 'beauty', includedTypes: ['beauty_salon', 'nail_salon'], excludedTypes: ['hair_salon', 'barber_shop'] },
  { kind: 'pharmacy', includedTypes: ['pharmacy'] },
  { kind: 'chemist', includedTypes: ['drugstore'], excludedTypes: ['pharmacy'] },
  // Facilities that support transactions
  { kind: 'atm', includedTypes: ['atm'], excludedTypes: ['bank'] },
  { kind: 'bank', includedTypes: ['bank'] },
  { kind: 'marketplace', includedTypes: ['market'] },
  {
    kind: 'place_of_worship',
    includedTypes: ['mosque', 'church', 'hindu_temple', 'buddhist_temple', 'synagogue', 'shinto_shrine'],
  },
  { kind: 'clinic', includedTypes: ['doctor', 'medical_clinic'], excludedTypes: ['hospital'] },
];

/** Kinds that come from Google counts whenever they are used, replacing OpenStreetMap facilities of the same kind. */
export const GOOGLE_COUNTED_KINDS: ReadonlySet<FacilityKind> = new Set(PLACE_COUNT_QUERIES.map((query) => query.kind));
