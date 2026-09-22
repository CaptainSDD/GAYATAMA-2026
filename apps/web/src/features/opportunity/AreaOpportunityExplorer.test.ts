import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OpportunitiesResponse } from '../../lib/api-types';
import { AreaOpportunityExplorer } from './AreaOpportunityExplorer';

const KECAMATAN = [
  'Semarang Tengah',
  'Semarang Utara',
  'Semarang Timur',
  'Semarang Selatan',
  'Semarang Barat',
  'Candisari',
  'Gajahmungkur',
  'Gayamsari',
  'Genuk',
  'Pedurungan',
  'Tembalang',
  'Banyumanik',
  'Gunungpati',
  'Mijen',
  'Ngaliyan',
  'Tugu',
];

/** Sixteen kecamatan as the API returns them: fourteen scored, one too thin to score, one that failed. */
const cells: OpportunitiesResponse['cells'] = KECAMATAN.map((label, index) => {
  const id = label.toLowerCase().replace(/\s+/g, '_');
  if (index === 14) return { id, label, lat: -7, lng: 110, status: 'insufficient_data', score: null, confidence: 22 };
  if (index === 15) return { id, label, lat: -7, lng: 110, status: 'unavailable', score: null, confidence: null };
  return { id, label, lat: -7, lng: 110, status: 'scored', score: 50 + index, confidence: 65 };
});

function render(overrides: Partial<OpportunitiesResponse> = {}, isPremium = false): string {
  const query = {
    isPending: false,
    isError: false,
    data: {
      businessType: 'laundry',
      source: 'OpenStreetMap',
      cells,
      ...overrides,
    },
  } as never;
  return renderToStaticMarkup(
    createElement(AreaOpportunityExplorer, {
      query,
      businessType: 'laundry',
      isPremium,
      onSelectPoint: () => {},
      onExit: () => {},
    }),
  );
}

describe('AreaOpportunityExplorer', () => {
  it('renders all sixteen kecamatan', () => {
    expect(render().match(/opportunity-point-row/g)?.length).toBeGreaterThanOrEqual(16);
    expect(render()).toContain('Semarang Tengah');
  });

  it('free tier shows every scored kecamatan as a non-clickable score, no confidence figure', () => {
    const html = render({}, false);
    expect(html.match(/<button[^>]*opportunity-point-button/g)).toBeNull();
    expect(html.match(/opportunity-point-row-locked/g)?.length).toBe(14);
    expect(html).not.toContain('yakin');
  });

  it('premium makes every scored kecamatan a clickable move into its detail, with confidence shown', () => {
    const html = render({}, true);
    expect(html.match(/<button[^>]*opportunity-point-button/g)?.length).toBe(14);
    expect(html).toContain('yakin');
  });

  it('labels an unscored kecamatan as unreadable, never as a bad location', () => {
    const html = render();
    expect(html).toContain('data tipis');
    expect(html).toContain('gagal');
  });

  it('marks the single highest-scoring kecamatan as best', () => {
    expect(render()).toContain('opportunity-point-row-best');
  });

  it('names the representative-point simplification and OpenStreetMap-only limitation', () => {
    const html = render();
    expect(html).toContain('kecamatan');
    expect(html).toContain('OpenStreetMap');
  });

  it('offers a way back to picking a point directly', () => {
    expect(render()).toContain('Pilih titik sendiri di peta');
  });
});
