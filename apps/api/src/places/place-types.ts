import type { FacilityKind, FacilityScale } from '@gayatama/scoring';

// Google place types → engine facility kinds, for the Places Aggregate API.
//
// Google counts the small businesses OpenStreetMap misses, and nothing else.
// The facilities that drive demand — campuses, schools, offices, housing,
// transit stops, hospitals, malls — stay with OpenStreetMap, which maps those
// large features well and which the segment points were calibrated against.
// Counting them from Google as well pinned every segment in an Indonesian city
// to 100, so the score stopped telling locations apart. Photocopy, print and
// stationery shops have no Table A type at all, and come from OpenStreetMap
// and Overture. See docs/data-sources.md#google-maps-business-counts.
//
// Filters accept only the types in Table A of Google's place types list. Types
// excluded from one query are the ones counted by another, so a place carrying
// both is counted once.

export const GOOGLE_PLACES_SOURCE = 'google';

export interface PlaceCountQuery {
  kind: FacilityKind;
  includedTypes: readonly string[];
  excludedTypes?: readonly string[];
  /** Defaults to `medium`, as for OpenStreetMap facilities. */
  scale?: FacilityScale;
}

export const PLACE_COUNT_QUERIES: readonly PlaceCountQuery[] = [
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
];

/** Kinds that come from Google counts whenever they are used, replacing OpenStreetMap facilities of the same kind. */
export const GOOGLE_COUNTED_KINDS: ReadonlySet<FacilityKind> = new Set(PLACE_COUNT_QUERIES.map((query) => query.kind));
