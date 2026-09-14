import { z } from 'zod';
import { INDONESIA_BOUNDS } from '../analysis/schemas';

const OUTSIDE_INDONESIA = 'Coordinate is outside Indonesia, which GAYATAMA covers';

export const locationQuerySchema = z.object({
  lat: z.coerce.number().min(INDONESIA_BOUNDS.minLat, OUTSIDE_INDONESIA).max(INDONESIA_BOUNDS.maxLat, OUTSIDE_INDONESIA),
  lng: z.coerce.number().min(INDONESIA_BOUNDS.minLng, OUTSIDE_INDONESIA).max(INDONESIA_BOUNDS.maxLng, OUTSIDE_INDONESIA),
});

export type LocationQuery = z.infer<typeof locationQuerySchema>;
