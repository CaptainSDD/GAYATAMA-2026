import { z } from 'zod';

/** `.env.example` ships empty values; treat them as unset. */
const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
);

export const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  OVERPASS_URL: z.string().url().default('https://overpass-api.de/api/interpreter'),
  OVERPASS_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  POI_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
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
