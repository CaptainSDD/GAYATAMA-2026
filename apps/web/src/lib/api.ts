import type { BusinessType, LatLng } from '@gayatama/scoring';
import type { AnalysisResponse, ApiErrorBody, PoisResponse, RecommendResponse } from './api-types';

/** A username reserved and a profile document created. Nothing more — the account itself lives in Firebase Auth. */
export interface RegisterProfileResponse {
  username: string;
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

// `googleMap` tells the API the results are shown on a Google map, the only case in which it may use Google data.

export function fetchAnalysis(point: LatLng, businessType: BusinessType, googleMap: boolean, signal?: AbortSignal) {
  return postJson<AnalysisResponse>('/analysis', { lat: point.lat, lng: point.lng, businessType, googleMap }, signal);
}

export function fetchRecommendation(point: LatLng, googleMap: boolean, signal?: AbortSignal) {
  return postJson<RecommendResponse>('/recommend', { lat: point.lat, lng: point.lng, googleMap }, signal);
}

export function fetchPois(point: LatLng, googleMap: boolean, signal?: AbortSignal) {
  const query = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng), googleMap: String(googleMap) });
  return request<PoisResponse>(`/pois?${query.toString()}`, { signal });
}

/**
 * Reserves a username and creates the Firestore profile document. `idToken`
 * proves who the caller is — the API verifies it against Firebase Auth
 * itself before trusting anything in the body.
 */
export function registerProfile(idToken: string, username: string, signal?: AbortSignal) {
  return postJson<RegisterProfileResponse>('/auth/register-profile', { username }, signal, {
    authorization: `Bearer ${idToken}`,
  });
}
