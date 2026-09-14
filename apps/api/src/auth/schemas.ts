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
