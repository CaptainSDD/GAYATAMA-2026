import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { OpportunitiesResponse } from '../../lib/api-types';

vi.mock('../../lib/queries', () => ({
  useOpportunities: vi.fn(),
  useLocationDetails: vi.fn(() => ({ isPending: false, data: { address: null } })),
  // The representative point's full analysis isn't under test here — pending
  // forever keeps `ScorePanel` (which needs a whole `AnalysisResponse`) out
  // of the tree without faking one.
  useAnalysis: vi.fn(() => ({ isPending: true, isError: false, isSuccess: false })),
}));

const { useOpportunities } = await import('../../lib/queries');
const { KecamatanDetail } = await import('./KecamatanDetail');

/** Nine local candidates: six scored, one too thin, two failed — six is more than the five shown. */
const cells: OpportunitiesResponse['cells'] = [
  { id: 'semarang_tengah_0', label: 'Semarang Tengah', lat: -7, lng: 110, status: 'scored', score: 60, confidence: 65 },
  { id: 'semarang_tengah_1', label: 'Semarang Tengah', lat: -7, lng: 110, status: 'scored', score: 82, confidence: 70 },
  { id: 'semarang_tengah_2', label: 'Semarang Tengah', lat: -7, lng: 110, status: 'scored', score: 71, confidence: 68 },
  { id: 'semarang_tengah_3', label: 'Semarang Tengah', lat: -7, lng: 110, status: 'scored', score: 55, confidence: 60 },
  { id: 'semarang_tengah_4', label: 'Semarang Tengah', lat: -7, lng: 110, status: 'scored', score: 90, confidence: 75 },
  { id: 'semarang_tengah_5', label: 'Semarang Tengah', lat: -7, lng: 110, status: 'scored', score: 40, confidence: 50 },
  { id: 'semarang_tengah_6', label: 'Semarang Tengah', lat: -7, lng: 110, status: 'insufficient_data', score: null, confidence: 20 },
  { id: 'semarang_tengah_7', label: 'Semarang Tengah', lat: -7, lng: 110, status: 'unavailable', score: null, confidence: null },
  { id: 'semarang_tengah_8', label: 'Semarang Tengah', lat: -7, lng: 110, status: 'unavailable', score: null, confidence: null },
];

function render(): string {
  vi.mocked(useOpportunities).mockReturnValue({
    isPending: false,
    isError: false,
    data: { businessType: 'laundry', source: 'OpenStreetMap', cells },
  } as never);

  return renderToStaticMarkup(
    createElement(KecamatanDetail, {
      kecamatanId: 'semarang_tengah',
      label: 'Semarang Tengah',
      point: { lat: -6.9786542, lng: 110.4217815 },
      businessType: 'laundry',
      onSelectPoint: () => {},
      onBack: () => {},
    }),
  );
}

describe('KecamatanDetail', () => {
  it('shows at most five candidates, best first, out of nine tried', () => {
    const html = render();
    expect(html.match(/candidate-card-button/g)?.length).toBe(5);
    // 90 is the highest score among the nine, so it must lead.
    const first = html.indexOf('90');
    const second = html.indexOf('82');
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(second);
  });

  it('names the kecamatan and the representative-point caveat', () => {
    const html = render();
    expect(html).toContain('Semarang Tengah');
    expect(html).toContain('bukan pencarian menyeluruh');
  });

  it('offers a way back to the sixteen-kecamatan list', () => {
    expect(render()).toContain('Kembali ke daftar kecamatan');
  });

  it('reports when a candidate has no address yet rather than inventing one', () => {
    expect(render()).toContain('Alamat belum tersedia');
  });
});
