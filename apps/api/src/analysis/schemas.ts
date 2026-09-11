import { ANALYSIS_RADIUS_METERS, BUSINESS_TYPES, type BusinessType } from '@gayatama/scoring';
import { z } from 'zod';

/** GAYATAMA's OpenStreetMap tag mapping and categories are designed for Indonesia. */
export const INDONESIA_BOUNDS = { minLat: -11.5, maxLat: 6.5, minLng: 94.5, maxLng: 141.5 } as const;

const OUTSIDE_INDONESIA = 'Coordinate is outside Indonesia, which GAYATAMA covers';

const latitude = (base: z.ZodNumber) =>
  base.min(INDONESIA_BOUNDS.minLat, OUTSIDE_INDONESIA).max(INDONESIA_BOUNDS.maxLat, OUTSIDE_INDONESIA);
const longitude = (base: z.ZodNumber) =>
  base.min(INDONESIA_BOUNDS.minLng, OUTSIDE_INDONESIA).max(INDONESIA_BOUNDS.maxLng, OUTSIDE_INDONESIA);

const businessType = z.enum(BUSINESS_TYPES as unknown as [BusinessType, ...BusinessType[]]);

export const recommendRequestSchema = z
  .object({ lat: latitude(z.number()), lng: longitude(z.number()) })
  .strict();

export const analysisRequestSchema = z
  .object({ lat: latitude(z.number()), lng: longitude(z.number()), businessType })
  .strict();

export const poisQuerySchema = z.object({
  lat: latitude(z.coerce.number()),
  lng: longitude(z.coerce.number()),
  radius: z.coerce.number().positive().max(ANALYSIS_RADIUS_METERS).default(ANALYSIS_RADIUS_METERS),
});

export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type PoisQuery = z.infer<typeof poisQuerySchema>;
