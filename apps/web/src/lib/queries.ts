import type { BusinessType, LatLng } from '@gayatama/scoring';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalysis, fetchPois, fetchRecommendation, shouldRetry } from './api';
import { USE_GOOGLE_MAP } from './map-config';

/** Results for a location change only when its map data does, so they stay fresh for a while. */
const STALE_TIME_MS = 10 * 60_000;

function requirePoint(point: LatLng | null): LatLng {
  if (point === null) throw new Error('No location selected');
  return point;
}

export function useAnalysis(point: LatLng | null, businessType: BusinessType) {
  return useQuery({
    queryKey: ['analysis', point, businessType, USE_GOOGLE_MAP],
    queryFn: ({ signal }) => fetchAnalysis(requirePoint(point), businessType, USE_GOOGLE_MAP, signal),
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

export function usePois(point: LatLng | null) {
  return useQuery({
    queryKey: ['pois', point, USE_GOOGLE_MAP],
    queryFn: ({ signal }) => fetchPois(requirePoint(point), USE_GOOGLE_MAP, signal),
    enabled: point !== null,
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
  });
}
