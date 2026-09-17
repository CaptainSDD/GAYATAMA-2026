import { describe, expect, it } from 'vitest';
import { toMinutes, weeklyHours } from './hours';

describe('toMinutes', () => {
  it('reads a time as minutes after midnight', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('08:30')).toBe(510);
    expect(toMinutes('23:59')).toBe(1439);
  });

  it('rejects an empty or malformed value, which a time input can return', () => {
    expect(toMinutes('')).toBeNull();
    expect(toMinutes('8:30')).toBeNull();
    expect(toMinutes('24:00')).toBeNull();
    expect(toMinutes('12:60')).toBeNull();
  });
});

describe('weeklyHours', () => {
  it('repeats one interval across all seven days', () => {
    const hours = weeklyHours(480, 1200);
    expect(hours).toHaveLength(7);
    expect(hours?.map((interval) => interval.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(hours?.every((interval) => interval.from === 480 && interval.to === 1200)).toBe(true);
  });

  it('rejects overnight hours rather than guessing how to split them', () => {
    expect(weeklyHours(1200, 120)).toBeNull();
  });

  it('rejects a zero-length day, which the API would refuse anyway', () => {
    expect(weeklyHours(600, 600)).toBeNull();
  });
});
