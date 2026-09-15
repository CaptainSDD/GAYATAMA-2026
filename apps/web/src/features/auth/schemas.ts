import { z } from 'zod';

// Client-side validation, so a form gives feedback before it ever reaches
// Firebase Auth or the API. Mirrors the pattern in
// apps/api/src/analysis/schemas.ts: rules live here, not scattered in JSX.

const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
const PASSWORD_HAS_LETTER = /[a-zA-Z]/;
const PASSWORD_HAS_NUMBER = /[0-9]/;

export const emailSchema = z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid');

/**
 * 3–20 characters, starting with a letter, letters/numbers/underscore only.
 * Firebase Auth has no concept of a username at all — this is purely ours,
 * enforced uniquely by the API against Firestore.
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username minimal 3 karakter')
  .max(20, 'Username maksimal 20 karakter')
  .regex(USERNAME_PATTERN, 'Username harus diawali huruf, dan hanya boleh huruf, angka, atau garis bawah');

/**
 * Stricter than Firebase Auth's own bare minimum of 6 characters — a floor
 * we don't control, so we add a floor of our own on top of it.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Kata sandi minimal 8 karakter')
  .refine((value) => PASSWORD_HAS_LETTER.test(value), 'Kata sandi harus mengandung huruf')
  .refine((value) => PASSWORD_HAS_NUMBER.test(value), 'Kata sandi harus mengandung angka');

export const signupSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Field-level errors, keyed by field name, for inline display under each input. */
export type FieldErrors<T extends z.ZodTypeAny> = Partial<Record<keyof z.infer<T>, string>>;

export function fieldErrors<T extends z.ZodTypeAny>(result: z.SafeParseReturnType<unknown, z.infer<T>>): FieldErrors<T> {
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in errors)) errors[key] = issue.message;
  }
  return errors as FieldErrors<T>;
}
