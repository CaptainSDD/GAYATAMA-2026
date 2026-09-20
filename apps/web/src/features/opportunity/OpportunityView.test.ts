import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OpportunitiesResponse } from '../../lib/api-types';
import { OpportunityView } from './OpportunityView';

/** Nine cells as the API returns them: seven scored, one too thin to score, one that failed. */
const cells: OpportunitiesResponse['cells'] = [
  { id: '1:-1', lat: -7.0018, lng: 110.4318, status: 'scored', score: 72.47, confidence: 67.88 },
  { id: '1:0', lat: -7.0018, lng: 110.435, status: 'scored', score: 73.26, confidence: 67.88 },
  { id: '1:1', lat: -7.0018, lng: 110.4381, status: 'scored', score: 72.79, confidence: 67.91 },
  { id: '0:-1', lat: -7.005, lng: 110.4318, status: 'scored', score: 75.02, confidence: 67.89 },
  { id: '0:0', lat: -7.005, lng: 110.435, status: 'scored', score: 73.05, confidence: 61.23 },
  { id: '0:1', lat: -7.005, lng: 110.4381, status: 'scored', score: 70.93, confidence: 61.23 },
  { id: '-1:-1', lat: -7.0081, lng: 110.4318, status: 'scored', score: 79.51, confidence: 74.56 },
  { id: '-1:0', lat: -7.0081, lng: 110.435, status: 'insufficient_data', score: null, confidence: 22 },
  { id: '-1:1', lat: -7.0081, lng: 110.4381, status: 'unavailable', score: null, confidence: null },
];

function render(overrides: Partial<OpportunitiesResponse> = {}): string {
  const query = {
    isPending: false,
    isError: false,
    data: {
      center: { lat: -7.005, lng: 110.435 },
      businessType: 'laundry',
      source: 'OpenStreetMap',
      spacingMeters: 350,
      cells,
      ...overrides,
    },
  } as never;
  return renderToStaticMarkup(
    createElement(OpportunityView, {
      query,
      businessType: 'laundry',
      onAnalysePoint: () => {},
      onHoverPoint: () => {},
    }),
  );
}

describe('OpportunityView', () => {
  it('renders all nine cells', () => {
    expect(render().match(/opportunity-cell/g)?.length).toBeGreaterThanOrEqual(9);
  });

  it('names the best cell by direction and distance rather than by grid id', () => {
    const html = render();
    expect(html).toContain('barat daya');
    // The diagonal cell is 495 m away, not the 350 m spacing.
    expect(html).toContain('495 m');
    expect(html).not.toContain('-1:-1');
  });

  it('reports how far the best cell is above the visitor own point', () => {
    expect(render()).toContain('6,5 poin di atas titik Anda');
  });

  it('labels an unscored cell as unreadable, never as a bad location', () => {
    const html = render();
    expect(html).toContain('data tipis');
    expect(html).toContain('gagal');
  });

  /** 9 cells − the centre − 2 without a score: only a cell worth moving to is a button. */
  it('offers a move only for scored cells that are not the centre', () => {
    expect(render().match(/<button[^>]*opportunity-cell/g)?.length).toBe(6);
  });

  it('says so plainly when the visitor own point already wins', () => {
    const centreWins = cells.map((cell) => (cell.id === '0:0' ? { ...cell, score: 99 } : cell));
    const html = render({ cells: centreWins });
    expect(html).toContain('adalah yang terbaik');
    expect(html).not.toContain('Analisis titik itu');
  });

  it('does not invent a winner when no cell could be scored', () => {
    const noneScored = cells.map((cell) => ({ ...cell, status: 'unavailable' as const, score: null }));
    const html = render({ cells: noneScored });
    expect(html).toContain('Tidak ada satu pun');
    expect(html).not.toContain('Analisis titik itu');
  });
});
