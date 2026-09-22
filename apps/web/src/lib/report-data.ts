import type { QueryClient } from '@tanstack/react-query';
import { fetchPois, fetchRecommendation } from './api';
import type { AnalysisResponse, PoisResponse, RecommendResponse } from './api-types';
import { USE_GOOGLE_MAP } from './map-config';

/** Matches STALE_TIME_MS in queries.ts, so a tab already visited costs no second request. */
const STALE_TIME_MS = 10 * 60_000;

export interface ReportData {
  analysis: AnalysisResponse;
  /** Every category ranked, for the "Pilihan usaha" chapter. `null` when it could not be loaded. */
  recommend: RecommendResponse | null;
  /** Facility detail behind the customer groups. */
  pois: PoisResponse | null;
}

/**
 * Collects everything the four tabs show, for a report that does not depend on
 * which tabs the reader happened to open.
 *
 * Only the score, customer groups and competition come from the analysis already
 * in hand. Rankings and the facility breakdown are separate endpoints that the
 * interface deliberately defers until their tab is opened, so the export has to
 * ask for them. The area explorer is not part of this: it is not tied to any
 * one analysed point, so it has no place in a single location's report.
 *
 * Routed through the query client with the same keys the hooks use, so a tab that
 * has already been read is free and the report cannot disagree with the screen.
 * Each request settles on its own: one failing chapter is reported as missing
 * rather than losing the others.
 */
export async function gatherReportData(
  client: QueryClient,
  analysis: AnalysisResponse,
  idToken: string,
): Promise<ReportData> {
  // The point the API echoed back, which is the same rounded point the hooks
  // keyed on. Should they ever differ, the only cost is a repeated request.
  const point = analysis.location;

  const [recommend, pois] = await Promise.all([
    client
      .fetchQuery({
        queryKey: ['recommend', point, USE_GOOGLE_MAP],
        queryFn: ({ signal }) => fetchRecommendation(idToken, point, USE_GOOGLE_MAP, signal),
        staleTime: STALE_TIME_MS,
      })
      .catch(() => null),
    client
      .fetchQuery({
        queryKey: ['pois', point, USE_GOOGLE_MAP],
        queryFn: ({ signal }) => fetchPois(idToken, point, USE_GOOGLE_MAP, signal),
        staleTime: STALE_TIME_MS,
      })
      .catch(() => null),
  ]);

  return { analysis, recommend, pois };
}
