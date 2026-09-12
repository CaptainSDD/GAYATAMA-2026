import { buildOvertureArea, type RawOvertureArea } from '../scripts/build-overture-places';
import type { RawOverturePlace } from '../src/overture/overture-place';
import { ORIGIN, offset } from './fixtures';

function raw(id: string, name: string, north: number, overrides: Partial<RawOverturePlace> = {}): RawOverturePlace {
  const { lat, lon } = offset(ORIGIN, north, 0);
  return {
    id,
    name,
    category: 'printing_services',
    alternateCategories: null,
    basicCategory: 'printing_service',
    confidence: 0.8,
    operatingStatus: null,
    sources: [{ dataset: 'meta', license: 'CDLA-Permissive-2.0', updateTime: '2026-08-10T00:00:00.000Z' }],
    lat,
    lng: lon,
    ...overrides,
  };
}

describe('buildOvertureArea', () => {
  it('keeps each shop in the circle once, preferring the more confident record', () => {
    const area: RawOvertureArea = {
      id: 'test-area',
      name: 'Test area',
      center: ORIGIN,
      radiusMeters: 3000,
      release: '2026-08-19.0',
      places: [
        raw('b-duplicate', 'Rama Copy Center', 105, { confidence: 0.4 }),
        raw('a-shop', 'Rama Fotocopy', 100),
        raw('c-bookstore', 'Gramedia', 300, { category: 'bookstore' }),
        raw('d-outside', 'Prima Fotocopy', 3500),
        raw('e-unlikely', 'Bale Aksara ATK', 500, { confidence: 0.1 }),
        raw('f-printer', 'Percetakan Mapan', 900, { confidence: 0.28 }),
      ],
    };

    const built = buildOvertureArea(area, '2026-09-12T00:00:00Z');

    expect(built).toMatchObject({ version: 1, id: 'test-area', release: '2026-08-19.0', generatedAt: '2026-09-12T00:00:00Z' });
    expect(built.places.map((place) => [place.id, place.kind])).toEqual([
      ['a-shop', 'copyshop'],
      ['f-printer', 'printer'],
    ]);
  });
});
