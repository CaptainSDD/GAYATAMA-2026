import { BUSINESS_TYPES, COMPONENT_KEYS, type BusinessType, type ComponentWeights, type LatLng } from '@gayatama/scoring';
import { isInsideSemarangBoundary } from './semarang-boundary';

/** Mirrors INDONESIA_BOUNDS in apps/api/src/analysis/schemas.ts; the API rejects anything outside. */
export const INDONESIA_BOUNDS = { minLat: -11.5, maxLat: 6.5, minLng: 94.5, maxLng: 141.5 } as const;

/** Panning limits around Central Java; everything reachable outside coverage is masked. */
export const SEMARANG_MAP_LIMITS = { south: -8, north: -6, west: 109, east: 112 } as const;

/** Centre of Semarang's initial map view. This moves the camera only; it is not a selected location. */
export const DEFAULT_CENTER: LatLng = { lat: -6.9904, lng: 110.4229 };

export const DEFAULT_BUSINESS_TYPE: BusinessType = 'laundry';

export interface Selection {
  point: LatLng | null;
  businessType: BusinessType;
  /** null means the documented baseline; the engine is never sent anything. */
  weights: ComponentWeights | null;
}

export function isInIndonesia({ lat, lng }: LatLng): boolean {
  return (
    lat >= INDONESIA_BOUNDS.minLat &&
    lat <= INDONESIA_BOUNDS.maxLat &&
    lng >= INDONESIA_BOUNDS.minLng &&
    lng <= INDONESIA_BOUNDS.maxLng
  );
}

export function isInSemarangCoverage(point: LatLng): boolean {
  return isInsideSemarangBoundary(point);
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

/**
 * Weights ride in the URL as one compact `w=35,20,20,15,10`, ordered by
 * COMPONENT_KEYS. They have to: an analysis link is shareable, and a link that
 * carried the point but not the weights would show the recipient a different
 * number from the one the sender saw. Saved-to-account alone cannot fix that,
 * because the recipient is a different account.
 */
function parseWeights(params: URLSearchParams): ComponentWeights | null {
  const raw = params.get('w')?.trim();
  if (raw === undefined || raw === '') return null;

  const parts = raw.split(',');
  if (parts.length !== COMPONENT_KEYS.length) return null;

  const weights = {} as ComponentWeights;
  for (const [index, key] of COMPONENT_KEYS.entries()) {
    const value = Number(parts[index]);
    if (!Number.isFinite(value) || value < 0 || value > 100) return null;
    weights[key] = value;
  }
  return Object.values(weights).some((value) => value > 0) ? weights : null;
}

export function serializeWeights(weights: ComponentWeights): string {
  return COMPONENT_KEYS.map((key) => Number(weights[key].toFixed(2))).join(',');
}

/** Reads `?lat=…&lng=…&type=…&w=…`. A missing, invalid or out-of-coverage point is ignored. */
export function parseSelection(search: string): Selection {
  const params = new URLSearchParams(search);
  const lat = coordinate(params, 'lat');
  const lng = coordinate(params, 'lng');
  const type = params.get('type');
  const point = lat !== null && lng !== null && isInSemarangCoverage({ lat, lng }) ? roundPoint({ lat, lng }) : null;
  return {
    point,
    businessType: isBusinessType(type) ? type : DEFAULT_BUSINESS_TYPE,
    weights: parseWeights(params),
  };
}

export function serializeSelection({ point, businessType, weights }: Selection): string {
  const params = new URLSearchParams();
  if (point !== null) {
    params.set('lat', point.lat.toFixed(6));
    params.set('lng', point.lng.toFixed(6));
  }
  params.set('type', businessType);
  if (weights !== null && weights !== undefined) params.set('w', serializeWeights(weights));
  return `?${params.toString()}`;
}
