import { parseOpeningHours } from '../src/overpass/opening-hours';

const every = (from: number, to: number, days = [0, 1, 2, 3, 4, 5, 6]) => days.map((day) => ({ day, from, to }));

describe('parseOpeningHours', () => {
  it('parses 24/7', () => {
    expect(parseOpeningHours('24/7')).toEqual(every(0, 1440));
  });

  it('parses a day range', () => {
    expect(parseOpeningHours('Mo-Fr 07:30-16:00')).toEqual(every(450, 960, [0, 1, 2, 3, 4]));
  });

  it('treats a closing time of 00:00 as midnight', () => {
    expect(parseOpeningHours('Mo-Su 07:00-00:00')).toEqual(every(420, 1440));
  });

  it('applies several rules', () => {
    expect(parseOpeningHours('Mo-Th 07:00-15:30; Fr 06:30-14:30')).toEqual([
      ...every(420, 930, [0, 1, 2, 3]),
      { day: 4, from: 390, to: 870 },
    ]);
  });

  it('parses split hours and days off', () => {
    const hours = parseOpeningHours('Mo-Sa 08:00-12:00, 13:00-17:00; Su off');
    expect(hours).toHaveLength(12);
    expect(hours?.some((interval) => interval.day === 6)).toBe(false);
  });

  it('lets a later rule replace earlier rules for the same day', () => {
    const hours = parseOpeningHours('Mo-Fr 08:00-17:00; We off');
    expect(hours?.map((interval) => interval.day)).toEqual([0, 1, 3, 4]);
  });

  it('carries hours past midnight into the next day', () => {
    expect(parseOpeningHours('Fr-Sa 18:00-02:00')).toEqual([
      { day: 4, from: 1080, to: 1440 },
      { day: 5, from: 0, to: 120 },
      { day: 5, from: 1080, to: 1440 },
      { day: 6, from: 0, to: 120 },
    ]);
  });

  it('wraps day ranges across the week', () => {
    expect(parseOpeningHours('Sa-Mo 09:00-12:00')?.map((interval) => interval.day)).toEqual([0, 5, 6]);
  });

  it('applies a rule without days to every day, and ignores holiday rules', () => {
    expect(parseOpeningHours('10:00-22:00; PH off')).toEqual(every(600, 1320));
  });

  it.each(['', 'sunrise-sunset', 'Jan-Mar Mo-Fr 08:00-12:00', 'Mo-Fr 18:00+', 'Mo-Fr', 'Mo-Fr 25:00-26:00', 'Mo 08:00-12:00 || "by appointment"'])(
    'returns undefined for unsupported value %j',
    (value) => {
      expect(parseOpeningHours(value)).toBeUndefined();
    },
  );
});
