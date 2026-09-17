import { classifyLocation } from '../src/location/location-eligibility';

describe('classifyLocation', () => {
  it.each([
    [{ category: 'natural.water' }, 'water'],
    [{ categories: ['natural.water.sea'] }, 'water'],
    [{ datasource: { raw: { natural: 'wetland' } } }, 'wetland'],
    [{ datasource: { raw: { landuse: 'aquaculture' } } }, 'aquaculture'],
  ] as const)('rejects an explicitly mapped %s surface', (result, reason) => {
    expect(classifyLocation(result)).toEqual({ status: 'ineligible', reason });
  });

  it('keeps an ordinary mapped address eligible', () => {
    expect(classifyLocation({ category: 'building', datasource: { raw: { building: 'retail' } } })).toEqual({ status: 'eligible' });
  });

  it('keeps an unavailable reverse lookup unknown instead of rejecting it', () => {
    expect(classifyLocation(null)).toEqual({ status: 'unknown' });
  });
});
