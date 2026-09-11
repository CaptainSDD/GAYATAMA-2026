import { HOURS_OVERLAP, OPERATING_HOURS_FACTOR } from './constants.js';
import { atLeast, clamp } from './math.js';
import type { WeeklyHours } from './types.js';

const MINUTES_PER_DAY = 1440;
type Interval = [start: number, end: number];

/** Opening intervals grouped by day, clamped to the day and merged where they overlap. */
function intervalsByDay(hours: WeeklyHours): Interval[][] {
  const days: Interval[][] = [[], [], [], [], [], [], []];
  for (const { day, from, to } of hours) {
    const list = Number.isInteger(day) ? days[day] : undefined;
    if (list === undefined) continue;
    const start = clamp(from, 0, MINUTES_PER_DAY);
    const end = clamp(to, 0, MINUTES_PER_DAY);
    if (end > start) list.push([start, end]);
  }

  return days.map((list) => {
    const merged: Interval[] = [];
    for (const [start, end] of [...list].sort((a, b) => a[0] - b[0])) {
      const last = merged[merged.length - 1];
      if (last !== undefined && start <= last[1]) last[1] = Math.max(last[1], end);
      else merged.push([start, end]);
    }
    return merged;
  });
}

export function weeklyMinutes(hours: WeeklyHours): number {
  let total = 0;
  for (const day of intervalsByDay(hours)) {
    for (const [start, end] of day) total += end - start;
  }
  return total;
}

export function overlapMinutes(a: WeeklyHours, b: WeeklyHours): number {
  const daysA = intervalsByDay(a);
  const daysB = intervalsByDay(b);
  let total = 0;
  daysA.forEach((intervalsA, day) => {
    for (const [startA, endA] of intervalsA) {
      for (const [startB, endB] of daysB[day] ?? []) {
        total += Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
      }
    }
  });
  return total;
}

/**
 * How much of a competitor's pressure applies, given how far its hours overlap
 * the business's own. Unknown competitor hours take the documented 0.80; when
 * the business's own hours are not set, every competitor with known hours is
 * treated as fully overlapping.
 */
export function operatingHoursFactor(target: WeeklyHours | undefined, competitor: WeeklyHours | undefined): number {
  if (competitor === undefined) return OPERATING_HOURS_FACTOR.unknown;
  if (target === undefined) return OPERATING_HOURS_FACTOR.strong;

  const targetMinutes = weeklyMinutes(target);
  if (targetMinutes === 0) return OPERATING_HOURS_FACTOR.strong;

  const share = overlapMinutes(target, competitor) / targetMinutes;
  if (atLeast(share, HOURS_OVERLAP.strong)) return OPERATING_HOURS_FACTOR.strong;
  if (atLeast(share, HOURS_OVERLAP.partial)) return OPERATING_HOURS_FACTOR.partial;
  if (share > 0) return OPERATING_HOURS_FACTOR.minimal;
  return OPERATING_HOURS_FACTOR.closed;
}
