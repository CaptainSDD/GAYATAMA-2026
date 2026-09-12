import { haversineMeters, type Facility, type FacilityKind, type LatLng } from '@gayatama/scoring';

// Overture Maps places → GAYATAMA's photocopy, printing and stationery kinds,
// the only kinds taken from Overture: OpenStreetMap maps these small shops
// thinly in Indonesia, and Google has no place type for them. Overture's own
// categories are unreliable here — photocopy shops are mostly filed under
// printing services, and office-equipment entries include safe and furniture
// dealers — so a clear name decides before the category does.
// See docs/data-sources.md#overture-maps-places.

export type OvertureKind = Extract<FacilityKind, 'copyshop' | 'printer' | 'stationery_shop'>;

export const OVERTURE_KINDS: ReadonlySet<FacilityKind> = new Set<FacilityKind>(['copyshop', 'printer', 'stationery_shop']);

export const OVERTURE_SOURCE = 'overture';
export const OVERTURE_ID_PREFIX = `${OVERTURE_SOURCE}/`;

/** PROPOSED: below this Overture confidence a place is left out, because it may not exist. */
export const MIN_OVERTURE_CONFIDENCE = 0.2;
/** PROPOSED: below this a place is kept with the "category doubtful" Data Quality, 0.40. */
export const DOUBTFUL_OVERTURE_CONFIDENCE = 0.5;

/**
 * Source licences the published data satisfies by including the CDLA Permissive
 * 2.0 text. Apache-2.0 sources (Foursquare) would also require their NOTICE file,
 * so places drawing on them are left out.
 */
export const USABLE_OVERTURE_LICENCES: ReadonlySet<string> = new Set(['CDLA-Permissive-2.0', 'CC0-1.0']);

/** PROPOSED: two Overture records this close are one shop. */
export const SAME_PLACE_METERS = 10;
/** PROPOSED: an Overture place this close to an OpenStreetMap shop is that shop; the two sources position shops less consistently. */
export const SAME_PLACE_ACROSS_SOURCES_METERS = 25;
/** PROPOSED: records with the same name this close are one shop. */
export const SAME_NAME_METERS = 150;

/** One place as written by overture_extract.py. */
export interface RawOverturePlace {
  id: string;
  name: string | null;
  category: string | null;
  alternateCategories: string[] | null;
  basicCategory: string | null;
  confidence: number | null;
  operatingStatus: string | null;
  sources: { dataset: string | null; license: string | null; updateTime: string | null }[];
  lat: number;
  lng: number;
}

/** A photocopy, printing or stationery shop from Overture, as published in apps/api/data/overture-places. */
export interface OverturePlace {
  /** Overture's GERS ID. */
  id: string;
  kind: OvertureKind;
  name?: string;
  lat: number;
  lng: number;
  confidence: number;
  /** The latest update time among the place's upstream sources. */
  updatedAt?: string;
}

const COPY_NAME = /foto\s*-?\s*c?opy|fotokop|photo\s*-?\s*copy|\bcopy\b/i;
/** "FC" means fotocopy on a printing business; elsewhere it is as likely a football club. */
const COPY_ABBREVIATION = /\bfc\b/i;
const STATIONERY_NAME = /\batk\b|alat\s*tulis|stationer/i;
/** Names that mean a printing business on their own. A bare "printer" is often a printer repair or sales shop. */
const PRINT_BUSINESS_NAME = /percetakan|digital\s*print|offset/i;
const PRINT_NAME = /print|cetak|grafika|offset/i;
/** Specialist printers — invitations, stickers, labels, banners, signage, garments — that do not compete with a photocopy shop. */
const SPECIALIST_PRINT_NAME =
  /undangan|sti[c]?ker|label|spanduk|banner|baliho|reklame|advertis|neon\s*box|sablon|konveksi|kaos|kalender|souvenir|merchandise/i;
const PRINTING_CATEGORY = 'printing_services';
/** A name never overrides these categories: a "Copy Cafe" is a café. */
const NAME_PROOF_CATEGORIES = new Set([
  'cafe',
  'coffee_shop',
  'restaurant',
  'fast_food_restaurant',
  'bar',
  'hotel',
  'school',
  'college_university',
]);

export function overtureKind(
  place: Pick<RawOverturePlace, 'name' | 'category' | 'alternateCategories' | 'basicCategory'>,
): OvertureKind | null {
  const name = place.name ?? '';
  const printing = place.category === PRINTING_CATEGORY;
  const nameDecides = !NAME_PROOF_CATEGORIES.has(place.basicCategory ?? '');

  if (nameDecides && (COPY_NAME.test(name) || (printing && COPY_ABBREVIATION.test(name)))) return 'copyshop';
  if (nameDecides && STATIONERY_NAME.test(name)) return 'stationery_shop';
  if (SPECIALIST_PRINT_NAME.test(name)) return null;
  if (printing || (nameDecides && PRINT_BUSINESS_NAME.test(name))) return 'printer';
  if ((place.alternateCategories ?? []).includes(PRINTING_CATEGORY) && PRINT_NAME.test(name)) return 'printer';
  return null;
}

const round7 = (value: number): number => Math.round(value * 1e7) / 1e7;

/** The published record for a raw place, or null when it is not a shop GAYATAMA takes from Overture. */
export function toOverturePlace(raw: RawOverturePlace): OverturePlace | null {
  const kind = overtureKind(raw);
  const confidence = raw.confidence ?? 0;
  if (kind === null || confidence < MIN_OVERTURE_CONFIDENCE || raw.operatingStatus === 'permanently_closed') return null;
  const licensed =
    raw.sources.length > 0 &&
    raw.sources.every(({ license }) => license !== null && USABLE_OVERTURE_LICENCES.has(license));
  if (!licensed) return null;

  const place: OverturePlace = {
    id: raw.id,
    kind,
    lat: round7(raw.lat),
    lng: round7(raw.lng),
    confidence: Math.round(confidence * 1000) / 1000,
  };
  const name = raw.name?.trim();
  if (name !== undefined && name !== '') place.name = name;

  // The "Overture" source entry dates the release build, not the place.
  let latest: { value: string; time: number } | undefined;
  for (const { dataset, updateTime } of raw.sources) {
    if (dataset === 'Overture' || updateTime === null) continue;
    const time = Date.parse(updateTime);
    if (!Number.isNaN(time) && (latest === undefined || time > latest.time)) latest = { value: updateTime, time };
  }
  if (latest !== undefined) place.updatedAt = latest.value;
  return place;
}

/** The engine facility for a published place. Its update time dates it like an OpenStreetMap edit. */
export function overtureFacility(place: OverturePlace): Facility {
  const facility: Facility = { id: `${OVERTURE_ID_PREFIX}${place.id}`, kind: place.kind, lat: place.lat, lng: place.lng };
  if (place.name !== undefined) facility.name = place.name;
  if (place.updatedAt !== undefined) facility.lastEditDate = place.updatedAt;
  if (place.confidence < DOUBTFUL_OVERTURE_CONFIDENCE) facility.doubtfulCategory = true;
  return facility;
}

const LEGAL_FORMS = new Set(['pt', 'cv', 'ud', 'tbk']);

/** A name's words in order, without punctuation or legal forms: "PT. Ragam Jasa Indah" and "Ragam Jasa Indah PT" match. */
function nameKey(name: string | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '' && !LEGAL_FORMS.has(word))
    .sort()
    .join(' ');
}

interface Named extends LatLng {
  name?: string;
}

export function samePlace(a: Named, b: Named, nearMeters: number): boolean {
  const distance = haversineMeters(a, b);
  if (distance <= nearMeters) return true;
  const key = nameKey(a.name);
  return distance <= SAME_NAME_METERS && key !== '' && key === nameKey(b.name);
}

/** Overture facilities for shops OpenStreetMap does not already list as open. */
export function withoutOpenStreetMapDuplicates(overture: readonly Facility[], openStreetMap: readonly Facility[]): Facility[] {
  const shops = openStreetMap.filter((facility) => OVERTURE_KINDS.has(facility.kind) && facility.closed !== true);
  return overture.filter((place) => !shops.some((shop) => samePlace(place, shop, SAME_PLACE_ACROSS_SOURCES_METERS)));
}
