import { z } from 'zod';

/**
 * Mirrors apps/web/src/features/auth/schemas.ts. Email and password never
 * reach the API at all — Firebase Auth handles those directly from the
 * client — so this only validates the one thing that is genuinely ours.
 */
export const registerProfileSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be at most 20 characters')
      .regex(/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/, 'Username must start with a letter and contain only letters, numbers or underscores'),
  })
  .strict();

export type RegisterProfileRequest = z.infer<typeof registerProfileSchema>;

/**
 * A saved weight set. Values are arbitrary non-negative numbers, not
 * percentages: the engine normalises them so they sum to 1, which is what
 * keeps a customised score on the same 0-100 scale its bands are read
 * against. All five keys are required, so a partial save can never leave a
 * profile holding a set that means something different from what the visitor
 * saw.
 */
export const componentWeightsSchema = z
  .object({
    demandFit: z.number().min(0).max(100),
    accessibility: z.number().min(0).max(100),
    competition: z.number().min(0).max(100),
    supportingFacility: z.number().min(0).max(100),
    risk: z.number().min(0).max(100),
  })
  .strict()
  .refine(
    (weights) => Object.values(weights).reduce((sum, value) => sum + value, 0) > 0,
    'At least one weight must be above zero',
  );

export const saveWeightsSchema = z.object({ weights: componentWeightsSchema.nullable() }).strict();

export type ComponentWeightsRequest = z.infer<typeof componentWeightsSchema>;
export type SaveWeightsRequest = z.infer<typeof saveWeightsSchema>;

/**
 * The whole "upgrade/downgrade" request. No payment fields exist because
 * there is no payment behind this — see `AuthService.setPlan`.
 */
export const setPlanSchema = z.object({ plan: z.enum(['free', 'premium']) }).strict();

export type SetPlanRequest = z.infer<typeof setPlanSchema>;
