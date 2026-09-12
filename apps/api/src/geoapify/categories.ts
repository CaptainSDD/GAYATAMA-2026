import type { FacilityKind } from '@gayatama/scoring';

/**
 * Geoapify categories requested for a POI cell. Only categories the engine can
 * use are requested: Places API is billed per result (1 credit per 20 places),
 * so fetching unmappable places would cost credits for nothing.
 *
 * Geoapify categories are hierarchical, so a parent key also returns its
 * children (`catering.cafe` includes `catering.cafe.bubble_tea`).
 */
export const PLACE_CATEGORIES: readonly string[] = [
  // Catering — competitors for beverages and food
  'catering.cafe',
  'catering.restaurant',
  'catering.fast_food',
  'catering.food_court',
  // Retail
  'commercial.supermarket',
  'commercial.convenience',
  'commercial.shopping_mall',
  'commercial.department_store',
  'commercial.marketplace',
  'commercial.stationery',
  'commercial.chemist',
  'commercial.health_and_beauty.pharmacy',
  // Demand generators
  'education.school',
  'education.college',
  'education.university',
  'healthcare.hospital',
  'healthcare.pharmacy',
  'healthcare.clinic_or_praxis',
  'office',
  'building.residential',
  'building.dormitory',
  'accommodation.hostel',
  'accommodation.guest_house',
  // Services
  'service.cleaning.laundry',
  'service.cleaning.dry_cleaning',
  'service.beauty',
  'service.financial.bank',
  'service.financial.atm',
  // Supporting facilities and infrastructure
  'religion.place_of_worship',
  'public_transport.bus',
  'public_transport.train',
  'public_transport.subway',
  'parking',
];

/**
 * Geoapify categories → engine facility kinds, most specific first. Used only
 * when the OpenStreetMap tags Geoapify carries are missing or unmapped; the
 * OSM normaliser in `overpass/normalize.ts` stays the primary mapping.
 */
const CATEGORY_KINDS: readonly (readonly [string, FacilityKind])[] = [
  ['catering.cafe.bubble_tea', 'bubble_tea'],
  ['catering.cafe', 'cafe'],
  ['catering.restaurant', 'restaurant'],
  ['catering.fast_food', 'fast_food'],
  ['catering.food_court', 'food_court'],
  ['commercial.shopping_mall', 'mall'],
  ['commercial.department_store', 'mall'],
  ['commercial.supermarket', 'supermarket'],
  ['commercial.convenience', 'convenience'],
  ['commercial.marketplace', 'marketplace'],
  ['commercial.stationery', 'stationery_shop'],
  ['commercial.health_and_beauty.pharmacy', 'pharmacy'],
  ['commercial.chemist', 'chemist'],
  ['education.university', 'campus'],
  ['education.college', 'campus'],
  ['education.school', 'school'],
  ['healthcare.hospital', 'hospital'],
  ['healthcare.pharmacy', 'pharmacy'],
  ['healthcare.clinic_or_praxis', 'clinic'],
  ['healthcare.dentist', 'clinic'],
  ['service.cleaning.dry_cleaning', 'dry_cleaning'],
  ['service.cleaning.laundry', 'laundry'],
  ['service.beauty.hairdresser', 'hairdresser'],
  ['service.beauty', 'beauty'],
  ['service.financial.atm', 'atm'],
  ['service.financial.bank', 'bank'],
  ['religion.place_of_worship', 'place_of_worship'],
  ['public_transport', 'transit'],
  ['parking', 'parking'],
  ['accommodation.hostel', 'boarding_house'],
  ['accommodation.guest_house', 'boarding_house'],
  ['office.government', 'government_office'],
  ['office', 'office'],
  ['building.dormitory', 'boarding_house'],
  ['building.university', 'campus'],
  ['building.school', 'school'],
  ['building.office', 'office'],
  ['building.residential', 'housing'],
];

/** Kinds that are large by definition, mirroring `isLarge` in the OSM normaliser. */
export const LARGE_KINDS: ReadonlySet<FacilityKind> = new Set<FacilityKind>(['campus', 'hospital', 'mall']);

/** The most specific engine kind for a Geoapify category list, or `null` when none applies. */
export function categoryKind(categories: readonly string[]): FacilityKind | null {
  for (const [category, kind] of CATEGORY_KINDS) {
    const match = categories.some((value) => value === category || value.startsWith(`${category}.`));
    if (match) return kind;
  }
  return null;
}
