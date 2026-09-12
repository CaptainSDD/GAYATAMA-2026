import { z } from 'zod';

/** `.env.example` ships empty values; treat them as unset. */
const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
);

/** A comma-separated list of URLs. An empty value means an empty list. */
const urlList = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((url) => url.trim())
          .filter((url) => url !== '')
      : value,
  z.array(z.string().url()),
);

/** Public Overpass instances tried, in order, when OVERPASS_URL fails. */
export const DEFAULT_OVERPASS_FALLBACK_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** 30 days: the longest Google Maps Platform terms allow place counts to be cached. */
export const MAX_PLACE_COUNT_CACHE_SECONDS = 2_592_000;

export const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  OVERPASS_URL: z.string().url().default('https://overpass-api.de/api/interpreter'),
  OVERPASS_FALLBACK_URLS: urlList.default(DEFAULT_OVERPASS_FALLBACK_URLS),
  OVERPASS_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  POI_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
  /** Directory of OSM snapshot files. Defaults to apps/api/data/osm-snapshots. */
  OSM_SNAPSHOT_DIR: optionalString,
  /** Directory of Overture place files. Defaults to apps/api/data/overture-places. */
  OVERTURE_PLACES_DIR: optionalString,
  /** Server key for the Google Places Aggregate API. Without it, every facility comes from OpenStreetMap. */
  GOOGLE_PLACES_API_KEY: optionalString,
  GOOGLE_PLACES_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  /** Google Maps Platform terms allow place counts to be cached for at most 30 days. */
  PLACE_COUNT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().max(MAX_PLACE_COUNT_CACHE_SECONDS).default(604_800),
  /** Proxy hops to trust for the client IP. 0 locally; 1 behind Cloud Run. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_SERVICE_ACCOUNT_JSON: optionalString,
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
