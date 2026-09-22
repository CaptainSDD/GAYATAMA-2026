import type { BusinessType, ComponentWeights, LatLng, OperatorOptions } from '@gayatama/scoring';
import type {
  AnalysisResponse,
  ApiErrorBody,
  ComparisonResponse,
  LocationComparisonResponse,
  LocationDetailsResponse,
  OpportunitiesResponse,
  PoisResponse,
  ProfileResponse,
  RecommendResponse,
  SimulationResponse,
} from './api-types';

/** A username reserved and a profile document created. Nothing more — the account itself lives in Firebase Auth. */
export interface RegisterProfileResponse {
  username: string;
}

export interface VerificationStatusResponse {
  email: string | null;
  emailVerified: boolean;
}

export interface VerificationSendResponse {
  sent: boolean;
  /** Nothing was sent because the address was already verified. */
  alreadyVerified: boolean;
}

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** An error from the API, carrying the stable `error` code from docs/api.md. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isErrorBody(body: unknown): body is ApiErrorBody {
  return typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string';
}

export function toApiError(status: number, body: unknown): ApiError {
  if (isErrorBody(body)) return new ApiError(status, body.error, body.message ?? '', body.details);
  return new ApiError(status, 'UNKNOWN', `Unexpected response (HTTP ${status})`);
}

/**
 * Retry once when the API could not be reached or failed unexpectedly. Never
 * retry a 504: the API has already waited for OpenStreetMap, and a retry would
 * double the wait. Client errors, rate limits and insufficient data are final.
 */
export function shouldRetry(failureCount: number, error: Error): boolean {
  if (!(error instanceof ApiError) || failureCount >= 1) return false;
  return error.status === 0 || (error.status >= 500 && error.status !== 504);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the API');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, body);
  return body as T;
}

function postJson<T>(path: string, payload: unknown, signal?: AbortSignal, headers?: Record<string, string>): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
    signal,
  });
}

function authHeader(idToken: string): Record<string, string> {
  return { authorization: `Bearer ${idToken}` };
}

// `googleMap` tells the API the results are shown on a Google map, the only case in which it may use Google data.
// Every analysis route now requires sign-in — `idToken` proves who the caller is, the same way it already did for `fetchProfile`.

export function fetchAnalysis(
  idToken: string,
  point: LatLng,
  businessType: BusinessType,
  googleMap: boolean,
  weights?: ComponentWeights,
  signal?: AbortSignal,
) {
  return postJson<AnalysisResponse>(
    '/analysis',
    { lat: point.lat, lng: point.lng, businessType, googleMap, ...(weights === undefined ? {} : { weights }) },
    signal,
    authHeader(idToken),
  );
}

export function fetchRecommendation(idToken: string, point: LatLng, googleMap: boolean, signal?: AbortSignal) {
  return postJson<RecommendResponse>('/recommend', { lat: point.lat, lng: point.lng, googleMap }, signal, authHeader(idToken));
}

/** Compares every category for one point. No business type is sent: choosing one is what this answers. */
export function fetchComparison(idToken: string, point: LatLng, googleMap: boolean, signal?: AbortSignal) {
  return postJson<ComparisonResponse>('/compare', { lat: point.lat, lng: point.lng, googleMap }, signal, authHeader(idToken));
}

/** Compares exactly two points for one chosen category. */
export function fetchLocationComparison(
  idToken: string,
  a: LatLng,
  b: LatLng,
  businessType: BusinessType,
  googleMap: boolean,
  signal?: AbortSignal,
) {
  return postJson<LocationComparisonResponse>(
    '/compare-locations',
    { a, b, businessType, googleMap },
    signal,
    authHeader(idToken),
  );
}

export function fetchSimulation(
  idToken: string,
  point: LatLng,
  businessType: BusinessType,
  options: OperatorOptions,
  googleMap: boolean,
  signal?: AbortSignal,
) {
  return postJson<SimulationResponse>(
    '/simulate',
    { lat: point.lat, lng: point.lng, businessType, options, googleMap },
    signal,
    authHeader(idToken),
  );
}

/**
 * No point yet: the sixteen-kecamatan grid is fixed, so a business type is all
 * this needs. `kecamatanId` is the premium path — the API checks the caller's
 * plan server-side and answers `PREMIUM_REQUIRED` for a free account.
 */
export function fetchOpportunities(idToken: string, businessType: BusinessType, kecamatanId?: string, signal?: AbortSignal) {
  return postJson<OpportunitiesResponse>(
    '/opportunities',
    kecamatanId === undefined ? { businessType } : { businessType, kecamatanId },
    signal,
    authHeader(idToken),
  );
}

export function fetchPois(idToken: string, point: LatLng, googleMap: boolean, signal?: AbortSignal) {
  const query = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng), googleMap: String(googleMap) });
  return request<PoisResponse>(`/pois?${query.toString()}`, { signal, headers: authHeader(idToken) });
}

/** Lightweight address lookup. This endpoint does not load POIs or run the scoring engine. */
export function fetchLocationDetails(idToken: string, point: LatLng, signal?: AbortSignal) {
  const query = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
  return request<LocationDetailsResponse>(`/location?${query.toString()}`, { signal, headers: authHeader(idToken) });
}

/**
 * Reserves a username and creates the Firestore profile document. `idToken`
 * proves who the caller is — the API verifies it against Firebase Auth
 * itself before trusting anything in the body.
 */
/**
 * The profile the client cannot read from Firestore directly: rules deny every
 * client path to `users/`, so this endpoint is the only way the app learns its
 * own username or saved weights.
 */
export function fetchProfile(idToken: string, signal?: AbortSignal) {
  return request<ProfileResponse>('/auth/profile', { signal, headers: { authorization: `Bearer ${idToken}` } });
}

/** `null` clears the saved set and returns the account to the documented baseline. */
export function saveWeights(idToken: string, weights: ComponentWeights | null, signal?: AbortSignal) {
  return request<{ weights: ComponentWeights | null }>('/auth/profile/weights', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ weights }),
    signal,
  });
}

/**
 * The whole "upgrade/downgrade" flow: no payment gateway behind it, just an
 * authenticated write to the caller's own account — the demo toggle button.
 */
export function fetchSetPlan(idToken: string, plan: 'free' | 'premium', signal?: AbortSignal) {
  return request<{ plan: 'free' | 'premium' }>('/auth/profile/plan', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ plan }),
    signal,
  });
}

export function registerProfile(idToken: string, username: string, signal?: AbortSignal) {
  return postJson<RegisterProfileResponse>('/auth/register-profile', { username }, signal, {
    authorization: `Bearer ${idToken}`,
  });
}

/**
 * Live verification state, read by the API from Firebase Auth itself rather
 * than from the `email_verified` claim the caller's token carries — that claim
 * is a snapshot and stays stale for up to an hour after the link is followed.
 */
export function fetchVerificationStatus(idToken: string, signal?: AbortSignal) {
  return request<VerificationStatusResponse>('/auth/verification-status', {
    signal,
    headers: { authorization: `Bearer ${idToken}` },
  });
}

/**
 * Asks the API to send the verification email. `sent: false` with
 * `alreadyVerified: true` is a success, not a failure: there was nothing left
 * to verify. Throws `MAIL_NOT_CONFIGURED` when the server has no mail
 * transport, which is the signal to fall back to Firebase's own sender.
 */
export function requestVerificationEmail(idToken: string, signal?: AbortSignal) {
  return postJson<VerificationSendResponse>('/auth/verification-email', {}, signal, {
    authorization: `Bearer ${idToken}`,
  });
}
