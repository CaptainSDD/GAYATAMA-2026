import { BUSINESS_TYPES, type BusinessType, type LatLng } from '@gayatama/scoring';

/** Mirrors INDONESIA_BOUNDS in apps/api/src/analysis/schemas.ts; the API rejects anything outside. */
export const INDONESIA_BOUNDS = { minLat: -11.5, maxLat: 6.5, minLng: 94.5, maxLng: 141.5 } as const;

/** UNESA Ketintang, Surabaya. */
export const DEFAULT_CENTER: LatLng = { lat: -7.3145, lng: 112.7263 };

export const DEFAULT_BUSINESS_TYPE: BusinessType = 'laundry';

export interface Selection {
  point: LatLng | null;
  businessType: BusinessType;
}

export function isInIndonesia({ lat, lng }: LatLng): boolean {
  return (
    lat >= INDONESIA_BOUNDS.minLat &&
    lat <= INDONESIA_BOUNDS.maxLat &&
    lng >= INDONESIA_BOUNDS.minLng &&
    lng <= INDONESIA_BOUNDS.maxLng
  );
}

export function isBusinessType(value: string | null): value is BusinessType {
  return value !== null && (BUSINESS_TYPES as readonly string[]).includes(value);
}

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/** Six decimal places is about 11 cm: precise enough, and it keeps query keys stable. */
export function roundPoint({ lat, lng }: LatLng): LatLng {
  return { lat: round6(lat), lng: round6(lng) };
}

function coordinate(params: URLSearchParams, name: string): number | null {
  const raw = params.get(name)?.trim();
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Reads `?lat=…&lng=…&type=…`. A missing, invalid or out-of-coverage point is ignored. */
export function parseSelection(search: string): Selection {
  const params = new URLSearchParams(search);
  const lat = coordinate(params, 'lat');
  const lng = coordinate(params, 'lng');
  const type = params.get('type');
  const point = lat !== null && lng !== null && isInIndonesia({ lat, lng }) ? roundPoint({ lat, lng }) : null;
  return { point, businessType: isBusinessType(type) ? type : DEFAULT_BUSINESS_TYPE };
}

export function serializeSelection({ point, businessType }: Selection): string {
  const params = new URLSearchParams();
  if (point !== null) {
    params.set('lat', point.lat.toFixed(6));
    params.set('lng', point.lng.toFixed(6));
  }
  params.set('type', businessType);
  return `?${params.toString()}`;
}
