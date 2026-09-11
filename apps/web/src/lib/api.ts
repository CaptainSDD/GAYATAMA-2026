import type { BusinessType, LatLng } from '@gayatama/scoring';
import type { AnalysisResponse, ApiErrorBody, PoisResponse, RecommendResponse } from './api-types';

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

function postJson<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}

export function fetchAnalysis(point: LatLng, businessType: BusinessType, signal?: AbortSignal) {
  return postJson<AnalysisResponse>('/analysis', { lat: point.lat, lng: point.lng, businessType }, signal);
}

export function fetchRecommendation(point: LatLng, signal?: AbortSignal) {
  return postJson<RecommendResponse>('/recommend', { lat: point.lat, lng: point.lng }, signal);
}

export function fetchPois(point: LatLng, signal?: AbortSignal) {
  const query = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
  return request<PoisResponse>(`/pois?${query.toString()}`, { signal });
}
