/** Tolerance for threshold comparisons, so 69.99999999999999 still reaches 70. */
export const EPSILON = 1e-9;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function atLeast(value: number, threshold: number): boolean {
  return value >= threshold - EPSILON;
}

export function atMost(value: number, threshold: number): boolean {
  return value <= threshold + EPSILON;
}
