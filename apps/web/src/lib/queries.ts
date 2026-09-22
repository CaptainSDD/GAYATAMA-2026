import type { BusinessType, ComponentWeights, LatLng, OperatorOptions } from '@gayatama/scoring';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdToken } from '../features/auth/useIdToken';
import {
  fetchAnalysis,
  fetchProfile,
  fetchSetPlan,
  saveWeights,
  fetchComparison,
  fetchLocationComparison,
  fetchLocationDetails,
  fetchOpportunities,
  fetchPois,
  fetchRecommendation,
  fetchSimulation,
  shouldRetry,
} from './api';
import { USE_GOOGLE_MAP } from './map-config';

/** Results for a location change only when its map data does, so they stay fresh for a while. */
const STALE_TIME_MS = 10 * 60_000;

function requirePoint(point: LatLng | null): LatLng {
  if (point === null) throw new Error('No location selected');
  return point;
}

/**
 * Every analysis route now requires sign-in, so every hook below reads the
 * signed-in account's ID token itself via `useIdToken` — a cheap, global
 * subscription to Firebase's own auth state — rather than taking it as a
 * parameter. Threading it as a prop instead would mean thirty call sites
 * across the app (`MapPicker`, `SimulationPanel`, `KecamatanDetail`, …), most
 * of which have nothing else to do with auth.
 */

export function useAnalysis(point: LatLng | null, businessType: BusinessType, weights?: ComponentWeights) {
  const idToken = useIdToken();
  return useQuery({
    // The weights are part of the identity of a result, not a detail of how it
    // was fetched: two weight sets are two different answers for one point.
    queryKey: ['analysis', point, businessType, USE_GOOGLE_MAP, weights ?? null],
    queryFn: ({ signal }) => fetchAnalysis(idToken!, requirePoint(point), businessType, USE_GOOGLE_MAP, weights, signal),
    enabled: point !== null && idToken !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

export function useRecommendation(point: LatLng | null) {
  const idToken = useIdToken();
  return useQuery({
    queryKey: ['recommend', point, USE_GOOGLE_MAP],
    queryFn: ({ signal }) => fetchRecommendation(idToken!, requirePoint(point), USE_GOOGLE_MAP, signal),
    enabled: point !== null && idToken !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

/** Not keyed by business type: comparing every category is what answers which one to pick. */
export function useComparison(point: LatLng | null) {
  const idToken = useIdToken();
  return useQuery({
    queryKey: ['compare', point, USE_GOOGLE_MAP],
    queryFn: ({ signal }) => fetchComparison(idToken!, requirePoint(point), USE_GOOGLE_MAP, signal),
    enabled: point !== null && idToken !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

/** Both points and the category are part of the key: changing any of them is a different comparison. */
export function useLocationComparison(a: LatLng | null, b: LatLng | null, businessType: BusinessType) {
  const idToken = useIdToken();
  return useQuery({
    queryKey: ['compare-locations', a, b, businessType, USE_GOOGLE_MAP],
    queryFn: ({ signal }) =>
      fetchLocationComparison(idToken!, requirePoint(a), requirePoint(b), businessType, USE_GOOGLE_MAP, signal),
    enabled: a !== null && b !== null && idToken !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

export function usePois(point: LatLng | null) {
  const idToken = useIdToken();
  return useQuery({
    queryKey: ['pois', point, USE_GOOGLE_MAP],
    queryFn: ({ signal }) => fetchPois(idToken!, requirePoint(point), USE_GOOGLE_MAP, signal),
    enabled: point !== null && idToken !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

export function useLocationDetails(point: LatLng | null) {
  const idToken = useIdToken();
  return useQuery({
    queryKey: ['location-details', point],
    queryFn: ({ signal }) => fetchLocationDetails(idToken!, requirePoint(point), signal),
    enabled: point !== null && idToken !== null,
    staleTime: 24 * 60 * 60_000,
    retry: shouldRetry,
  });
}

/**
 * `enabled` gates this on the area explorer being open, not on any point —
 * there isn't one yet. `kecamatanId` is the premium path — the API checks the
 * caller's plan server-side; its own key so the city-wide list and a
 * kecamatan's detail cache separately.
 */
export function useOpportunities(enabled: boolean, businessType: BusinessType, kecamatanId?: string) {
  const idToken = useIdToken();
  return useQuery({
    queryKey: ['opportunities', businessType, kecamatanId ?? null],
    queryFn: ({ signal }) => fetchOpportunities(idToken!, businessType, kecamatanId, signal),
    enabled: enabled && idToken !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

/**
 * The options are part of the key, so each what-if set is cached on its own and
 * returning to an earlier one costs no request. `null` means nothing has been
 * applied yet and no request should run.
 */
export function useSimulation(point: LatLng | null, businessType: BusinessType, options: OperatorOptions | null) {
  const idToken = useIdToken();
  return useQuery({
    queryKey: ['simulate', point, businessType, options, USE_GOOGLE_MAP],
    queryFn: ({ signal }) => {
      if (options === null) throw new Error('No what-if options applied');
      return fetchSimulation(idToken!, requirePoint(point), businessType, options, USE_GOOGLE_MAP, signal);
    },
    enabled: point !== null && options !== null && idToken !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

/**
 * The signed-in account's profile. Kept out of the render path of the map: a
 * failure here must never stop a location being scored, so consumers read
 * `data` and ignore the error.
 */
export function useProfile(idToken: string | null) {
  return useQuery({
    queryKey: ['profile', idToken],
    queryFn: ({ signal }) => fetchProfile(idToken!, signal),
    enabled: idToken !== null,
    staleTime: STALE_TIME_MS,
    retry: false,
  });
}

export function useSaveWeights(idToken: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (weights: ComponentWeights | null) => saveWeights(idToken!, weights),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['profile', idToken] });
    },
  });
}

/**
 * The demo "upgrade/downgrade" button, server-side: no payment behind it,
 * just an authenticated write to the caller's own account, same shape as
 * `useSaveWeights`.
 */
export function useSetPlan(idToken: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (plan: 'free' | 'premium') => fetchSetPlan(idToken!, plan),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['profile', idToken] });
    },
  });
}
