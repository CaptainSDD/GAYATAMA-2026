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

export const analysisRequestSchema = z
  .object({ lat: latitude(z.number()), lng: longitude(z.number()), businessType, googleMap })
  .strict();

const openingInterval = z
  .object({
    day: z.number().int().min(0).max(6),
    from: z.number().int().min(0).max(1439),
    to: z.number().int().min(1).max(1440),
  })
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

/**
 * A deliberately small, on-demand grid for the opportunity-map demo. The
 * endpoint always uses OpenStreetMap-derived data: a Google aggregate is a
 * count around one circle and cannot be reused truthfully across grid cells.
 */
export const opportunitiesRequestSchema = z
  .object({ lat: latitude(z.number()), lng: longitude(z.number()), businessType })
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
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type SimulationRequest = z.infer<typeof simulationRequestSchema>;
export type OpportunitiesRequest = z.infer<typeof opportunitiesRequestSchema>;
export type PoisQuery = z.infer<typeof poisQuerySchema>;
