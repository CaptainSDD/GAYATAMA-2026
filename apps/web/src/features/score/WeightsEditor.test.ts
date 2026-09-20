import { COMPONENT_KEYS, type ComponentWeights } from '@gayatama/scoring';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHT_INPUTS,
  WeightsEditor,
  sameWeights,
  weightsEqualDefault,
  weightsToApply,
} from './WeightsEditor';

function render(weights: ComponentWeights | null): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(WeightsEditor, { weights, onChange: () => undefined }),
    ),
  );
}

const custom: ComponentWeights = { ...DEFAULT_WEIGHT_INPUTS, demandFit: 55 };

describe('weightsToApply', () => {
  /** Keeps the result labelled "bobot bawaan" and the shared link free of a redundant set. */
  it('sends null for a draft that matches the documented baseline', () => {
    expect(weightsToApply({ ...DEFAULT_WEIGHT_INPUTS })).toBeNull();
  });

  it('sends the set itself once any criterion differs', () => {
    expect(weightsToApply(custom)).toEqual(custom);
  });
});

describe('sameWeights', () => {
  it('ignores a difference too small to have come from either control', () => {
    const nudged = { ...DEFAULT_WEIGHT_INPUTS, risk: DEFAULT_WEIGHT_INPUTS.risk + 0.001 };
    expect(sameWeights(DEFAULT_WEIGHT_INPUTS, nudged)).toBe(true);
  });

  it('sees a whole-number change on any single criterion', () => {
    for (const key of COMPONENT_KEYS) {
      const changed = { ...DEFAULT_WEIGHT_INPUTS, [key]: DEFAULT_WEIGHT_INPUTS[key] + 1 };
      expect(sameWeights(DEFAULT_WEIGHT_INPUTS, changed)).toBe(false);
    }
  });
});

describe('weightsEqualDefault', () => {
  it('treats the absent set as the baseline', () => {
    expect(weightsEqualDefault(null)).toBe(true);
  });
});

describe('WeightsEditor rendering', () => {
  it('offers a typed number as well as a slider for every criterion', () => {
    const html = render(null);
    for (const key of COMPONENT_KEYS) {
      expect(html).toContain(`id="weight-${key}"`);
      expect(html).toContain(`id="weight-slider-${key}"`);
    }
    expect(html).toContain('type="number"');
    expect(html).toContain('type="range"');
  });

  /**
   * The contract the button exists for: an untouched editor has nothing to
   * apply, so the score cannot be refetched by simply opening the fold.
   */
  it('starts with nothing to apply and no unapplied-changes notice', () => {
    const html = render(custom);
    expect(html).toContain('Analisa lagi');
    expect(html).toContain('disabled');
    expect(html).not.toContain('belum dipakai');
  });

  it('shows the normalised share alongside the relative figure', () => {
    // 35 of a 100-point baseline is 35% of the applied weight.
    expect(render(null)).toContain('35%');
  });

  it('warns that a customised score is not comparable, once one is applied', () => {
    expect(render(custom)).toContain('tidak setara');
    expect(render(null)).not.toContain('tidak setara');
  });

  it('keeps the baseline reset unavailable while the draft is already the baseline', () => {
    expect(render(null)).toContain('Kembalikan ke bawaan');
  });
});
