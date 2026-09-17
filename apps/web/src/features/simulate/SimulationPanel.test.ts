import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisResponse } from '../../lib/api-types';
import { SimulationPanel } from './SimulationPanel';

function render(): string {
  const analysis = { location: { lat: -7.005, lng: 110.435 }, businessType: 'laundry' } as AnalysisResponse;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(SimulationPanel, { analysis })),
  );
}

describe('SimulationPanel', () => {
  it('offers the two things an owner controls', () => {
    const html = render();
    expect(html).toContain('Parkir sendiri di lokasi');
    expect(html).toContain('Jam buka sendiri');
    expect(html).toContain('type="range"');
  });

  /** Nothing is sent until a change is made: the endpoint runs a full analysis per call. */
  it('starts with the button disabled and no result on screen', () => {
    const html = render();
    expect(html).toContain('disabled');
    expect(html).not.toContain('simulate-result');
  });

  it('says the score above is the location as it stands', () => {
    expect(render()).toContain('apa adanya');
  });
});
