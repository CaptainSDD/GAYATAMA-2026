import type { FacilityKind } from '@gayatama/scoring';
import { GOOGLE_COUNTED_KINDS, PLACE_COUNT_QUERIES } from '../src/places/place-types';

/**
 * The Table A types these queries use, checked against Google's place types
 * list (developers.google.com/maps/documentation/places/web-service/place-types).
 * Filters reject any other type, so a new type must be checked there before it is added here.
 */
const TABLE_A_TYPES = new Set([
  'atm', 'bank', 'barber_shop', 'beauty_salon', 'buddhist_temple', 'bus_station', 'bus_stop', 'business_center',
  'cafe', 'church', 'city_hall', 'coffee_shop', 'coffee_stand', 'convenience_store', 'corporate_office',
  'coworking_space', 'department_store', 'doctor', 'drugstore', 'fast_food_restaurant', 'food_court',
  'government_office', 'grocery_store', 'hair_salon', 'hindu_temple', 'hospital', 'juice_shop', 'laundry',
  'light_rail_station', 'local_government_office', 'market', 'medical_clinic', 'mosque', 'nail_salon', 'pharmacy',
  'primary_school', 'restaurant', 'school', 'secondary_school', 'shinto_shrine', 'shopping_mall', 'subway_station',
  'supermarket', 'synagogue', 'tea_house', 'train_station', 'transit_station', 'transit_stop', 'university',
]);

describe('PLACE_COUNT_QUERIES', () => {
  it('uses only Table A types', () => {
    const types = PLACE_COUNT_QUERIES.flatMap((query) => [...query.includedTypes, ...(query.excludedTypes ?? [])]);
    expect(types.filter((type) => !TABLE_A_TYPES.has(type))).toEqual([]);
  });

  it('counts each type in one query only, and never includes and excludes the same type', () => {
    const included = PLACE_COUNT_QUERIES.flatMap((query) => query.includedTypes);
    expect(included.filter((type, index) => included.indexOf(type) !== index)).toEqual([]);
    for (const query of PLACE_COUNT_QUERIES) {
      expect(query.includedTypes.filter((type) => query.excludedTypes?.includes(type))).toEqual([]);
    }
  });

  it('leaves kinds without a suitable Google type to OpenStreetMap', () => {
    const openStreetMapOnly: FacilityKind[] = [
      'housing', 'boarding_house', 'parking', 'copyshop', 'printer', 'stationery_shop', 'dry_cleaning',
    ];
    expect(openStreetMapOnly.filter((kind) => GOOGLE_COUNTED_KINDS.has(kind))).toEqual([]);
  });
});
