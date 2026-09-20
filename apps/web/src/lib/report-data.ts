import type { QueryClient } from '@tanstack/react-query';
import { fetchOpportunities, fetchPois, fetchRecommendation } from './api';
import type { AnalysisResponse, OpportunitiesResponse, PoisResponse, RecommendResponse } from './api-types';
import { USE_GOOGLE_MAP } from './map-config';

/** Matches STALE_TIME_MS in queries.ts, so a tab already visited costs no second request. */
const STALE_TIME_MS = 10 * 60_000;

export interface ReportData {
  analysis: AnalysisResponse;
  /** Every category ranked, for the "Pilihan usaha" chapter. `null` when it could not be loaded. */
  recommend: RecommendResponse | null;
  /** The nine-point grid, for the "Peluang" chapter. */
  opportunities: OpportunitiesResponse | null;
  /** Facility detail behind the customer groups. */
  pois: PoisResponse | null;
}

/**
 * Collects everything the five tabs show, for a report that does not depend on
 * which tabs the reader happened to open.
 *
 * Only the score, customer groups and competition come from the analysis already
 * in hand. Rankings, the opportunity grid and the facility breakdown are
 * separate endpoints that the interface deliberately defers until their tab is
 * opened, so the export has to ask for them.
 *
 * Routed through the query client with the same keys the hooks use, so a tab that
 * has already been read is free and the report cannot disagree with the screen.
 * Each request settles on its own: one failing chapter is reported as missing
 * rather than losing the other four.
 */
export async function gatherReportData(client: QueryClient, analysis: AnalysisResponse): Promise<ReportData> {
  // The point the API echoed back, which is the same rounded point the hooks
  // keyed on. Should they ever differ, the only cost is a repeated request.
  const point = analysis.location;

  const [recommend, opportunities, pois] = await Promise.all([
    client
      .fetchQuery({
        queryKey: ['recommend', point, USE_GOOGLE_MAP],
        queryFn: ({ signal }) => fetchRecommendation(point, USE_GOOGLE_MAP, signal),
        staleTime: STALE_TIME_MS,
      })
      .catch(() => null),
    client
      .fetchQuery({
        queryKey: ['opportunities', point, analysis.businessType],
        queryFn: ({ signal }) => fetchOpportunities(point, analysis.businessType, signal),
        staleTime: STALE_TIME_MS,
      })
      .catch(() => null),
    client
      .fetchQuery({
        queryKey: ['pois', point, USE_GOOGLE_MAP],
        queryFn: ({ signal }) => fetchPois(point, USE_GOOGLE_MAP, signal),
        staleTime: STALE_TIME_MS,
      })
      .catch(() => null),
  ]);

  return { analysis, recommend, opportunities, pois };
}
