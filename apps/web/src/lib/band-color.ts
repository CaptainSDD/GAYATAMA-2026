import { band, type Band, type ConfidenceReading, type SaturationReading, type SegmentRole } from '@gayatama/scoring';

/**
 * Every colour in the interface is derived from an engine threshold, never from
 * a number written again here. Recalibrating the weights in
 * `packages/scoring/src/constants.ts` therefore recolours the interface on its
 * own, and the colours cannot drift away from the bands they claim to show.
 */

/** The five visual tones, ordered best to worst, plus one for "not applicable". */
export type Tone = 'excellent' | 'good' | 'fair' | 'poor' | 'bad' | 'neutral';

const BAND_TONES: Record<Band, Tone> = {
  highly_suitable: 'excellent',
  suitable: 'good',
  moderately_suitable: 'fair',
  risky: 'poor',
  not_recommended: 'bad',
};

const ROLE_TONES: Record<SegmentRole, Tone> = {
  primary: 'excellent',
  secondary: 'good',
  supporting: 'fair',
  insignificant: 'neutral',
};

const CONFIDENCE_TONES: Record<ConfidenceReading, Tone> = {
  high: 'excellent',
  good: 'good',
  moderate: 'fair',
  low: 'poor',
  very_low: 'bad',
};

/**
 * More competition is worse, so this scale runs the opposite way to the others:
 * an unsaturated market is the good end.
 */
const SATURATION_TONES: Record<SaturationReading, Tone> = {
  not_saturated: 'excellent',
  healthy: 'good',
  becoming_saturated: 'fair',
  saturated: 'poor',
  heavily_saturated: 'bad',
};

/** A CSS colour for a tone, for inline `style` on bars, arcs and markers. */
export function toneColor(tone: Tone): string {
  return `var(--tone-${tone})`;
}

/** The chip class for a tone, for tinted pills. */
export function toneChip(tone: Tone): string {
  return `chip chip-${tone}`;
}

/** Tone for any 0–100 score, using the same bands as the headline score. */
export function scoreTone(value: number): Tone {
  return BAND_TONES[band(value)];
}

export function bandTone(value: Band): Tone {
  return BAND_TONES[value];
}

export function roleTone(value: SegmentRole): Tone {
  return ROLE_TONES[value];
}

export function confidenceTone(value: ConfidenceReading): Tone {
  return CONFIDENCE_TONES[value];
}

export function saturationTone(value: SaturationReading): Tone {
  return SATURATION_TONES[value];
}
