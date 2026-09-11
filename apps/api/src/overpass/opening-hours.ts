import type { OpeningInterval, WeeklyHours } from '@gayatama/scoring';

// A deliberately small parser for the OpenStreetMap `opening_hours` formats that
// occur in practice, such as "Mo-Fr 08:00-17:00; Sa 08:00-12:00; Su off" and
// "24/7". Anything it does not understand returns `undefined`, which the engine
// scores as unknown hours rather than guessing.

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MINUTES_PER_DAY = 1440;
const DAY_TOKEN = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/;
const TIME_RANGE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;
/** Public and school holiday rules. Ignoring them misreads only a few days a year. */
const HOLIDAY_RULE = /^(PH|SH)\b/;

type Range = [from: number, to: number];

interface DayRule {
  own: Range[];
  /** Hours after midnight that belong to this day's rule. */
  spill: Range[];
}

function parseDays(text: string): number[] | null {
  const days = new Set<number>();
  for (const part of text.split(',')) {
    const match = DAY_TOKEN.exec(part);
    if (match === null) return null;
    const start = DAYS.indexOf(match[1] ?? '');
    const end = match[2] === undefined ? start : DAYS.indexOf(match[2]);
    for (let day = start; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === end) break;
    }
  }
  return [...days];
}

function minutes(hours: string | undefined, mins: string | undefined): number | null {
  const h = Number(hours);
  const m = Number(mins);
  if (!Number.isInteger(h) || !Number.isInteger(m) || m > 59 || h > 24 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
}

function parseTimes(text: string): DayRule | null {
  const rule: DayRule = { own: [], spill: [] };
  for (const part of text.split(',')) {
    const match = TIME_RANGE.exec(part);
    if (match === null) return null;
    const from = minutes(match[1], match[2]);
    let to = minutes(match[3], match[4]);
    if (from === null || to === null || from >= MINUTES_PER_DAY) return null;
    if (to === 0) to = MINUTES_PER_DAY;
    if (to > from) {
      rule.own.push([from, to]);
    } else {
      rule.own.push([from, MINUTES_PER_DAY]);
      rule.spill.push([0, to]);
    }
  }
  return rule;
}

export function parseOpeningHours(value: string | undefined): WeeklyHours | undefined {
  const text = value?.trim() ?? '';
  if (text === '') return undefined;
  if (text === '24/7') return DAYS.map((_, day) => ({ day, from: 0, to: MINUTES_PER_DAY }));
  if (text.includes('||') || text.includes('"')) return undefined;

  const week: DayRule[] = DAYS.map(() => ({ own: [], spill: [] }));

  for (const raw of text.split(';')) {
    const rule = raw.trim();
    if (rule === '' || HOLIDAY_RULE.test(rule)) continue;

    const timeStart = rule.search(/\d|\boff\b|\bclosed\b/);
    if (timeStart === -1) return undefined;
    const dayText = rule.slice(0, timeStart).replace(/\s+/g, '');
    const timeText = rule.slice(timeStart).replace(/\s+/g, '');

    const days = dayText === '' ? [0, 1, 2, 3, 4, 5, 6] : parseDays(dayText);
    if (days === null) return undefined;

    const parsed = timeText === 'off' || timeText === 'closed' ? { own: [], spill: [] } : parseTimes(timeText);
    if (parsed === null) return undefined;

    // A later rule replaces earlier rules for the days it names.
    for (const day of days) week[day] = parsed;
  }

  const intervals: OpeningInterval[] = [];
  week.forEach((rule, day) => {
    for (const [from, to] of rule.own) intervals.push({ day, from, to });
    for (const [from, to] of rule.spill) intervals.push({ day: (day + 1) % 7, from, to });
  });
  return intervals.sort((a, b) => a.day - b.day || a.from - b.from);
}
