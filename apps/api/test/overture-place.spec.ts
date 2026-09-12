import { dataQuality, type Facility } from '@gayatama/scoring';
import {
  MIN_OVERTURE_CONFIDENCE,
  SAME_PLACE_METERS,
  overtureFacility,
  overtureKind,
  samePlace,
  toOverturePlace,
  withoutOpenStreetMapDuplicates,
  type OverturePlace,
  type RawOverturePlace,
} from '../src/overture/overture-place';
import { ORIGIN, offset } from './fixtures';

const at = (north: number, east = 0) => {
  const { lat, lon } = offset(ORIGIN, north, east);
  return { lat, lng: lon };
};

const META = { dataset: 'meta', license: 'CDLA-Permissive-2.0', updateTime: '2026-08-10T00:00:00.000Z' };
const RELEASE_ENTRY = { dataset: 'Overture', license: 'CDLA-Permissive-2.0', updateTime: '2026-08-14T19:46:07Z' };

function raw(overrides: Partial<RawOverturePlace> = {}): RawOverturePlace {
  return {
    id: '08f00000000000000000000000000001',
    name: 'Rama Fotocopy',
    category: 'printing_services',
    alternateCategories: null,
    basicCategory: 'printing_service',
    confidence: 0.8,
    operatingStatus: null,
    sources: [META, RELEASE_ENTRY],
    ...at(100),
    ...overrides,
  };
}

function placeOf(record: RawOverturePlace): OverturePlace {
  const place = toOverturePlace(record);
  if (place === null) throw new Error(`${record.name ?? record.id} was not kept`);
  return place;
}

describe('overtureKind', () => {
  // Names and categories as they appear in Overture release 2026-08-19.0 around UNESA Ketintang and UPGRIS Semarang.
  it.each([
    { name: 'Rama Fotocopy', category: 'printing_services', alternate: null, kind: 'copyshop' },
    { name: 'Lattifa Copy and Printing', category: 'office_equipment', alternate: ['printing_services'], kind: 'copyshop' },
    { name: "Gunner's Photo Copy And Printing", category: 'convenience_store', alternate: null, kind: 'copyshop' },
    { name: 'Fc.camboja 2sby', category: 'printing_services', alternate: null, kind: 'copyshop' },
    { name: 'Bale Aksara ATK', category: 'office_equipment', alternate: ['retail'], kind: 'stationery_shop' },
    { name: 'Comart Stationery and Office Supplies', category: 'wholesale_store', alternate: null, kind: 'stationery_shop' },
    { name: 'Perum Percetakan Negara', category: 'printing_services', alternate: null, kind: 'printer' },
    { name: 'Percetakan Satria Mandiri', category: 'shopping', alternate: null, kind: 'printer' },
    { name: 'Aries digital printing', category: 'engineering_services', alternate: ['printing_services'], kind: 'printer' },
    { name: 'BERDAYA Printing', category: 'flowers_and_gifts_shop', alternate: ['printing_services'], kind: 'printer' },
    { name: 'Dealer Brankas', category: 'office_equipment', alternate: ['shopping'], kind: null },
    { name: 'Dokter Printer', category: 'professional_services', alternate: null, kind: null },
    { name: 'Gudang Printer dan Monitor', category: 'computer_store', alternate: ['electronics'], kind: null },
    { name: 'Harapan Jaya UD', category: 'shipping_center', alternate: ['printing_services'], kind: null },
    { name: 'Ornament', category: 'screen_printing_t_shirt_printing', alternate: ['clothing_store'], kind: null },
    { name: 'Gramedia Royal Plaza', category: 'bookstore', alternate: ['shopping'], kind: null },
    { name: 'Persebaya FC Store', category: 'sporting_goods', alternate: null, kind: null },
    { name: 'Blanko Undangan Cakra', category: 'printing_services', alternate: ['bridal_shop'], kind: null },
    { name: 'Top Sticker', category: 'printing_services', alternate: ['automotive_repair'], kind: null },
    { name: 'Tagen Labelindo PT', category: 'printing_services', alternate: null, kind: null },
    { name: 'Percetakan Spanduk Kain', category: 'screen_printing_t_shirt_printing', alternate: ['printing_services'], kind: null },
    { name: 'Konveksi, Percetakan & Sablon', category: 'printing_services', alternate: null, kind: null },
    { name: 'City Net & ATK', category: 'party_and_event_planning', alternate: ['professional_services'], kind: 'stationery_shop' },
  ])('$name ($category) → $kind', ({ name, category, alternate, kind }) => {
    expect(overtureKind({ name, category, alternateCategories: alternate, basicCategory: null })).toBe(kind);
  });

  it('never lets a name turn a café into a shop', () => {
    expect(overtureKind({ name: 'Copy Cafe', category: 'cafe', alternateCategories: null, basicCategory: 'cafe' })).toBeNull();
  });
});

describe('toOverturePlace', () => {
  it('keeps a shop with its position, confidence and latest source update', () => {
    const point = at(100);
    expect(toOverturePlace(raw())).toEqual({
      id: '08f00000000000000000000000000001',
      kind: 'copyshop',
      name: 'Rama Fotocopy',
      lat: expect.closeTo(point.lat, 6),
      lng: expect.closeTo(point.lng, 6),
      confidence: 0.8,
      updatedAt: '2026-08-10T00:00:00.000Z',
    });
  });

  it('dates a place by its upstream sources, not by the release entry', () => {
    expect(placeOf(raw({ sources: [RELEASE_ENTRY] })).updatedAt).toBeUndefined();
  });

  it('leaves out places that may not exist, have closed for good, or draw on Apache-licensed sources', () => {
    expect(toOverturePlace(raw({ confidence: MIN_OVERTURE_CONFIDENCE - 0.01 }))).toBeNull();
    expect(toOverturePlace(raw({ confidence: MIN_OVERTURE_CONFIDENCE }))).not.toBeNull();
    expect(toOverturePlace(raw({ confidence: null }))).toBeNull();
    expect(toOverturePlace(raw({ operatingStatus: 'permanently_closed' }))).toBeNull();
    expect(
      toOverturePlace(raw({ sources: [{ dataset: 'Foursquare', license: 'Apache-2.0', updateTime: '2026-04-01T00:00:00.000' }, RELEASE_ENTRY] })),
    ).toBeNull();
    expect(toOverturePlace(raw({ sources: [] }))).toBeNull();
  });
});

describe('overtureFacility', () => {
  it('scores a confident place like an undated OpenStreetMap record, and a doubtful one lower', () => {
    const confident = overtureFacility(placeOf(raw()));
    const doubtful = overtureFacility(placeOf(raw({ confidence: 0.3 })));

    expect(confident).toMatchObject({ id: 'overture/08f00000000000000000000000000001', kind: 'copyshop', name: 'Rama Fotocopy' });
    expect(dataQuality(confident, '2026-09-12')).toBe(0.65);
    expect(doubtful.doubtfulCategory).toBe(true);
    expect(dataQuality(doubtful, '2026-09-12')).toBe(0.4);
  });
});

describe('duplicates', () => {
  it('treats records that close, or with the same name nearby, as one shop', () => {
    expect(samePlace({ ...at(0), name: 'Rama Fotocopy' }, { ...at(8), name: 'Rama Copy' }, SAME_PLACE_METERS)).toBe(true);
    expect(samePlace({ ...at(0), name: 'Foto Copy Rizky' }, { ...at(30), name: 'Prima Fotocopy' }, SAME_PLACE_METERS)).toBe(false);
    expect(samePlace({ ...at(0), name: 'PT. Ragam Jasa Indah' }, { ...at(120), name: 'Ragam Jasa Indah PT' }, SAME_PLACE_METERS)).toBe(true);
    expect(samePlace({ ...at(0), name: 'Ragam Jasa Indah' }, { ...at(200), name: 'Ragam Jasa Indah' }, SAME_PLACE_METERS)).toBe(false);
  });

  it('drops Overture shops OpenStreetMap already lists as open', () => {
    const overture = [
      overtureFacility(placeOf(raw({ id: 'near-osm-shop', name: 'Rama Fotocopy', ...at(110) }))),
      overtureFacility(placeOf(raw({ id: 'new', name: 'Prima Fotocopy', ...at(400) }))),
      overtureFacility(placeOf(raw({ id: 'same-name', name: 'Toko Sinar ATK', ...at(700) }))),
    ];
    const openStreetMap: Facility[] = [
      { id: 'node/1', kind: 'copyshop', ...at(100) },
      { id: 'node/2', kind: 'cafe', ...at(400) },
      { id: 'node/3', kind: 'stationery_shop', name: 'Toko Sinar ATK', ...at(760) },
    ];

    expect(withoutOpenStreetMapDuplicates(overture, openStreetMap).map((facility) => facility.id)).toEqual(['overture/new']);

    const closed = openStreetMap.map((facility) => ({ ...facility, closed: true }));
    expect(withoutOpenStreetMapDuplicates(overture, closed)).toHaveLength(3);
  });
});
