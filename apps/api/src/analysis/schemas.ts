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

/**
 * The client shows the results on a Google map. Google Maps Platform terms
 * forbid using Google data with any other map, so Google counts are used only
 * when this is true.
 */
const googleMap = z.boolean().default(false);

export const recommendRequestSchema = z
  .object({ lat: latitude(z.number()), lng: longitude(z.number()), googleMap })
  .strict();

/** Same input as a ranking: the point is all that is needed, because no category is chosen yet. */
export const compareRequestSchema = z
  .object({ lat: latitude(z.number()), lng: longitude(z.number()), googleMap })
  .strict();

export const analysisRequestSchema = z
  .object({ lat: latitude(z.number()), lng: longitude(z.number()), businessType, googleMap })
  .strict();

const coordinate = z.object({ lat: latitude(z.number()), lng: longitude(z.number()) }).strict();

/**
 * Exactly two locations, by shape rather than by an array with a length rule:
 * a third candidate cannot be expressed, so the limit cannot be bypassed.
 */
export const compareLocationsRequestSchema = z
  .object({ a: coordinate, b: coordinate, businessType, googleMap })
  .strict();

export const poisQuerySchema = z.object({
  lat: latitude(z.coerce.number()),
  lng: longitude(z.coerce.number()),
  radius: z.coerce.number().positive().max(ANALYSIS_RADIUS_METERS).default(ANALYSIS_RADIUS_METERS),
  googleMap: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type CompareRequest = z.infer<typeof compareRequestSchema>;
export type CompareLocationsRequest = z.infer<typeof compareLocationsRequestSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type PoisQuery = z.infer<typeof poisQuerySchema>;

const openingInterval = z
  .object({ day: z.number().int().min(0).max(6), from: z.number().int().min(0).max(1439), to: z.number().int().min(1).max(1440) })
  .strict()
  .refine((value) => value.to > value.from, 'Opening time must be before closing time');

const operatorOptions = z
  .object({
    onSiteParkingSpaces: z.number().int().min(0).max(500).optional(),
    openingHours: z.array(openingInterval).max(7).optional(),
  })
  .strict();

export const simulationRequestSchema = z
  .object({ lat: latitude(z.number()), lng: longitude(z.number()), businessType, googleMap, options: operatorOptions })
  .strict();

/** OSM-only 3×3 opportunity grid; Google aggregates cannot be reused truthfully per cell. */
export const opportunitiesRequestSchema = z
  .object({ lat: latitude(z.number()), lng: longitude(z.number()), businessType })
  .strict();

export type SimulationRequest = z.infer<typeof simulationRequestSchema>;
export type OpportunitiesRequest = z.infer<typeof opportunitiesRequestSchema>;
