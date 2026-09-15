import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Facility, FacilityKind, LatLng } from '@gayatama/scoring';
import type { Env } from '../config/env';
import { toFacility } from '../overpass/normalize';

const ENDPOINT = 'https://api.geoapify.com/v2/places';
const RESULT_LIMIT = 500;

// Two parallel requests avoid one broad commercial result set crowding out
// schools, transport, parking and other less frequent facilities.
const CATEGORY_GROUPS = [
  ['catering', 'commercial', 'service.financial', 'service.cleaning'],
  [
    'education',
    'healthcare',
    'public_transport',
    'parking',
    'office',
    'building.office',
    'building.dormitory',
    'building.residential',
    'accommodation.hostel',
    'accommodation.guest_house',
    'religion',
  ],
] as const;

interface GeoapifyFeature {
  geometry?: { type?: string; coordinates?: unknown[] };
  properties?: {
    place_id?: unknown;
    name?: unknown;
    categories?: unknown;
    datasource?: { raw?: unknown };
  };
}

interface GeoapifyResponse {
  features?: GeoapifyFeature[];
}

/** Ordered from the most specific category to broad fallbacks. */
const CATEGORY_KINDS: readonly [string, FacilityKind][] = [
  ['catering.cafe.bubble_tea', 'bubble_tea'],
  ['catering.cafe', 'cafe'],
  ['catering.fast_food', 'fast_food'],
  ['catering.food_court', 'food_court'],
  ['catering.restaurant', 'restaurant'],
  ['commercial.supermarket', 'supermarket'],
  ['commercial.convenience', 'convenience'],
  ['commercial.shopping_mall', 'mall'],
  ['commercial.department_store', 'mall'],
  ['commercial.chemist', 'chemist'],
  ['healthcare.pharmacy', 'pharmacy'],
  ['healthcare.hospital', 'hospital'],
  ['healthcare.clinic_or_praxis', 'clinic'],
  ['education.university', 'campus'],
  ['education.college', 'campus'],
  ['education.school', 'school'],
  ['service.financial.atm', 'atm'],
  ['service.financial.bank', 'bank'],
  ['service.cleaning.laundry', 'laundry'],
  ['service.cleaning.dry_cleaning', 'dry_cleaning'],
  ['public_transport', 'transit'],
  ['parking', 'parking'],
  ['office.government', 'government_office'],
  ['office', 'office'],
  ['building.dormitory', 'boarding_house'],
  ['building.residential', 'housing'],
  ['accommodation.hostel', 'boarding_house'],
  ['accommodation.guest_house', 'boarding_house'],
  ['religion', 'place_of_worship'],
];

function stringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const entries = Object.entries(value).flatMap(([key, item]) => {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      return [[key, String(item)] as const];
    }
    return [];
  });
  return Object.fromEntries(entries);
}

function categoryKind(categories: readonly string[]): FacilityKind | null {
  for (const [prefix, kind] of CATEGORY_KINDS) {
    if (categories.some((category) => category === prefix || category.startsWith(`${prefix}.`))) return kind;
  }
  return null;
}

function fallbackTags(kind: FacilityKind | null): Record<string, string> {
  if (kind === null) return {};
  const amenityKinds: Partial<Record<FacilityKind, string>> = {
    campus: 'university',
    school: 'school',
    hospital: 'hospital',
    cafe: 'cafe',
    bubble_tea: 'cafe',
    restaurant: 'restaurant',
    fast_food: 'fast_food',
    food_court: 'food_court',
    pharmacy: 'pharmacy',
    atm: 'atm',
    bank: 'bank',
    place_of_worship: 'place_of_worship',
    clinic: 'clinic',
    transit: 'bus_station',
    parking: 'parking',
    government_office: 'townhall',
  };
  const shopKinds: Partial<Record<FacilityKind, string>> = {
    mall: 'mall',
    laundry: 'laundry',
    dry_cleaning: 'dry_cleaning',
    convenience: 'convenience',
    supermarket: 'supermarket',
    chemist: 'chemist',
  };
  const amenity = amenityKinds[kind];
  if (amenity !== undefined) return { amenity };
  const shop = shopKinds[kind];
  if (shop !== undefined) return { shop };
  if (kind === 'office') return { building: 'office' };
  if (kind === 'housing') return { building: 'apartments' };
  if (kind === 'boarding_house') return { building: 'dormitory' };
  return {};
}

function toGeoapifyFacility(feature: GeoapifyFeature): Facility | null {
  const coordinates = feature.geometry?.coordinates;
  const lng = coordinates?.[0];
  const lat = coordinates?.[1];
  const placeId = feature.properties?.place_id;
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof placeId !== 'string') return null;

  const categories = Array.isArray(feature.properties?.categories)
    ? feature.properties.categories.filter((value): value is string => typeof value === 'string')
    : [];
  const inferredKind = categoryKind(categories);
  const raw = stringRecord(feature.properties?.datasource?.raw);
  const name = feature.properties?.name;
  const tags = { ...fallbackTags(inferredKind), ...raw };
  if (typeof name === 'string' && tags.name === undefined) tags.name = name;
  if (inferredKind === 'bubble_tea' && tags.cuisine === undefined) tags.cuisine = 'bubble_tea';

  const facility = toFacility({ type: 'node', id: 0, lat, lon: lng, tags });
  return facility === null ? null : { ...facility, id: `geoapify/${placeId}` };
}

@Injectable()
export class GeoapifyPlacesClient {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get configured(): boolean {
    return this.config.get('GEOAPIFY_API_KEY', { infer: true }) !== undefined;
  }

  async placesAround(center: LatLng, radiusMeters: number): Promise<Facility[]> {
    const key = this.config.get('GEOAPIFY_API_KEY', { infer: true });
    if (key === undefined) return [];

    const groups = await Promise.all(
      CATEGORY_GROUPS.map((categories) => this.request(key, categories, center, radiusMeters)),
    );
    const facilities = new Map<string, Facility>();
    for (const feature of groups.flat()) {
      const facility = toGeoapifyFacility(feature);
      if (facility !== null) facilities.set(facility.id, facility);
    }
    return [...facilities.values()];
  }

  private async request(
    key: string,
    categories: readonly string[],
    center: LatLng,
    radiusMeters: number,
  ): Promise<GeoapifyFeature[]> {
    const url = new URL(ENDPOINT);
    url.searchParams.set('categories', categories.join(','));
    url.searchParams.set('filter', `circle:${center.lng},${center.lat},${Math.ceil(radiusMeters)}`);
    url.searchParams.set('bias', `proximity:${center.lng},${center.lat}`);
    url.searchParams.set('limit', String(RESULT_LIMIT));
    url.searchParams.set('apiKey', key);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(this.config.get('GEOAPIFY_TIMEOUT_MS', { infer: true })),
      });
    } catch (error) {
      throw new Error(`Geoapify Places request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw new Error(`Geoapify Places responded ${response.status}`);
    const body = (await response.json()) as GeoapifyResponse;
    return Array.isArray(body.features) ? body.features : [];
  }
}
