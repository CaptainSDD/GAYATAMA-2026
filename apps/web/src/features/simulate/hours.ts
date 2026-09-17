import type { OpeningInterval } from '@gayatama/scoring';

/** `"08:30"` to minutes after midnight, or `null` when the value is not a time. */
export function toMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * The same opening and closing time on all seven days. Overnight hours would
 * have to be split across two days, which the control does not offer, so a
 * closing time at or before the opening time is rejected rather than guessed at.
 */
export function weeklyHours(from: number, to: number): OpeningInterval[] | null {
  if (to <= from) return null;
  return Array.from({ length: 7 }, (_, day) => ({ day, from, to }));
}
