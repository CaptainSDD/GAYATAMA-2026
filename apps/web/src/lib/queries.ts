import type { BusinessType, ComponentWeights, LatLng, OperatorOptions } from '@gayatama/scoring';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAnalysis,
  fetchProfile,
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

export function useAnalysis(point: LatLng | null, businessType: BusinessType, weights?: ComponentWeights) {
  return useQuery({
    // The weights are part of the identity of a result, not a detail of how it
    // was fetched: two weight sets are two different answers for one point.
    queryKey: ['analysis', point, businessType, USE_GOOGLE_MAP, weights ?? null],
    queryFn: ({ signal }) => fetchAnalysis(requirePoint(point), businessType, USE_GOOGLE_MAP, weights, signal),
    enabled: point !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

export function useRecommendation(point: LatLng | null) {
  return useQuery({
    queryKey: ['recommend', point, USE_GOOGLE_MAP],
    queryFn: ({ signal }) => fetchRecommendation(requirePoint(point), USE_GOOGLE_MAP, signal),
    enabled: point !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

/** Not keyed by business type: comparing every category is what answers which one to pick. */
export function useComparison(point: LatLng | null) {
  return useQuery({
    queryKey: ['compare', point, USE_GOOGLE_MAP],
    queryFn: ({ signal }) => fetchComparison(requirePoint(point), USE_GOOGLE_MAP, signal),
    enabled: point !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

/** Both points and the category are part of the key: changing any of them is a different comparison. */
export function useLocationComparison(a: LatLng | null, b: LatLng | null, businessType: BusinessType) {
  return useQuery({
    queryKey: ['compare-locations', a, b, businessType, USE_GOOGLE_MAP],
    queryFn: ({ signal }) =>
      fetchLocationComparison(requirePoint(a), requirePoint(b), businessType, USE_GOOGLE_MAP, signal),
    enabled: a !== null && b !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

export function usePois(point: LatLng | null) {
  return useQuery({
    queryKey: ['pois', point, USE_GOOGLE_MAP],
    queryFn: ({ signal }) => fetchPois(requirePoint(point), USE_GOOGLE_MAP, signal),
    enabled: point !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}

export function useLocationDetails(point: LatLng | null) {
  return useQuery({
    queryKey: ['location-details', point],
    queryFn: ({ signal }) => fetchLocationDetails(requirePoint(point), signal),
    enabled: point !== null,
    staleTime: 24 * 60 * 60_000,
    retry: shouldRetry,
  });
}

export function useOpportunities(point: LatLng | null, businessType: BusinessType) {
  return useQuery({
    queryKey: ['opportunities', point, businessType],
    queryFn: ({ signal }) => fetchOpportunities(requirePoint(point), businessType, signal),
    enabled: point !== null,
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
  return useQuery({
    queryKey: ['simulate', point, businessType, options, USE_GOOGLE_MAP],
    queryFn: ({ signal }) => {
      if (options === null) throw new Error('No what-if options applied');
      return fetchSimulation(requirePoint(point), businessType, options, USE_GOOGLE_MAP, signal);
    },
    enabled: point !== null && options !== null,
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
