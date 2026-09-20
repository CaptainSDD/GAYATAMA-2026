import type { Tone } from './band-color';

/**
 * Chart building for the printed report.
 *
 * The report opens in a blank window, so nothing from the app reaches it: no
 * stylesheet, no charting library, no network. Every figure here is therefore
 * hand-built from SVG and plain HTML with literal colours, and every one has to
 * survive a print pipeline that drops background colours by default (see
 * `print-color-adjust` in report-export.ts).
 *
 * Thresholds are never decided here. Callers pass a `Tone` they obtained from
 * lib/band-color, which reads the engine's own band boundaries — this module
 * only knows what each tone looks like on paper.
 */

/** The light-theme tone ramp from styles.css, inlined because `var(--tone-*)` cannot resolve here. */
export const TONE_INK: Record<Tone, string> = {
  excellent: '#059669',
  good: '#0d9488',
  fair: '#ca8a04',
  poor: '#ea580c',
  bad: '#dc2626',
  neutral: '#94a3b8',
};

export const TONE_WASH: Record<Tone, string> = {
  excellent: '#d1fae5',
  good: '#ccfbf1',
  fair: '#fef9c3',
  poor: '#ffedd5',
  bad: '#fee2e2',
  neutral: '#f1f5f9',
};

export const TONE_TEXT: Record<Tone, string> = {
  excellent: '#064e3b',
  good: '#104f4b',
  fair: '#713f12',
  poor: '#7c2d12',
  bad: '#7f1d1d',
  neutral: '#334155',
};

export const INK = '#14213d';
export const MUTED = '#64748b';
export const RULE = '#e2e8f0';
export const TRACK = '#eef2f7';
export const BRAND = '#0f766e';

export function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export interface DonutOptions {
  value: number;
  /** Drawn as a lighter arc behind the value, for a score's uncertainty interval. */
  range?: [number, number];
  tone: Tone;
  /** Large text at the centre. */
  centre: string;
  /** Small text under it. */
  caption: string;
  size?: number;
}

/**
 * A ring gauge: the headline figure as a proportion of 100.
 *
 * Drawn as a full circle with a dash pattern rather than an arc path, which
 * keeps the geometry to one number and avoids the large-arc-flag trap that makes
 * hand-written arcs flip at the halfway mark. Rotated a quarter turn so it
 * starts at the top.
 */
export function donutChart({ value, range, tone, centre, caption, size = 150 }: DonutOptions): string {
  const stroke = Math.round(size * 0.12);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamp(value) / 100) * circumference;
  const mid = size / 2;

  // The interval arc starts where the low end of the range sits, so it reads as
  // "the answer is somewhere in here" rather than as a second score.
  const rangeArc =
    range === undefined
      ? ''
      : `<circle cx="${mid}" cy="${mid}" r="${radius}" fill="none" stroke="${TONE_WASH[tone]}" stroke-width="${stroke}"
           stroke-dasharray="${(((clamp(range[1]) - clamp(range[0])) / 100) * circumference).toFixed(2)} ${circumference.toFixed(2)}"
           stroke-dashoffset="${(-(clamp(range[0]) / 100) * circumference).toFixed(2)}" />`;

  return `<svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${escapeHtml(centre)} ${escapeHtml(caption)}">
    <g transform="rotate(-90 ${mid} ${mid})">
      <circle cx="${mid}" cy="${mid}" r="${radius}" fill="none" stroke="${TRACK}" stroke-width="${stroke}" />
      ${rangeArc}
      <circle cx="${mid}" cy="${mid}" r="${radius}" fill="none" stroke="${TONE_INK[tone]}" stroke-width="${stroke}"
        stroke-dasharray="${dash.toFixed(2)} ${circumference.toFixed(2)}" stroke-linecap="butt" />
    </g>
    <text x="${mid}" y="${mid - 2}" text-anchor="middle" dominant-baseline="central"
      font-size="${Math.round(size * 0.28)}" font-weight="700" fill="${TONE_INK[tone]}">${escapeHtml(centre)}</text>
    <text x="${mid}" y="${mid + Math.round(size * 0.2)}" text-anchor="middle" dominant-baseline="central"
      font-size="${Math.round(size * 0.093)}" fill="${MUTED}">${escapeHtml(caption)}</text>
  </svg>`;
}

export interface BarDatum {
  label: string;
  /** Plotted against `max`. */
  value: number;
  tone: Tone;
  /** Printed at the right instead of the raw value, when the value alone would mislead. */
  valueLabel?: string;
  /** A second line under the label. */
  note?: string;
  /** Drawn as a track with no fill, for an indicator that could not be scored. */
  empty?: boolean;
}

/**
 * A horizontal bar per row, as HTML rather than SVG: the labels are Indonesian
 * phrases that need to wrap, and text flow is the one thing HTML does better
 * than a hand-laid-out chart.
 */
export function barChart(data: readonly BarDatum[], max = 100): string {
  const rows = data
    .map((datum) => {
      const width = max <= 0 ? 0 : (clamp(datum.value, 0, max) / max) * 100;
      // An unscored indicator gets an empty track and nothing else: the reading
      // beside it already says "Belum dinilai", and a second label inside a 9px
      // track only crowds the row.
      const fill = datum.empty
        ? ''
        : `<span class="bar-fill" style="width:${width.toFixed(1)}%;background:${TONE_INK[datum.tone]}"></span>`;
      return `<div class="bar-row">
        <div class="bar-head">
          <span class="bar-label">${escapeHtml(datum.label)}</span>
          <span class="bar-value" style="color:${datum.empty ? MUTED : TONE_TEXT[datum.tone]}">${escapeHtml(
            datum.valueLabel ?? Math.round(datum.value),
          )}</span>
        </div>
        <div class="bar-track">${fill}</div>
        ${datum.note === undefined ? '' : `<p class="bar-note">${escapeHtml(datum.note)}</p>`}
      </div>`;
    })
    .join('');
  return `<div class="bar-chart">${rows}</div>`;
}

export interface HeatCell {
  /** Grid position label, e.g. "utara". */
  label: string;
  /** `null` when the cell could not be scored. */
  value: number | null;
  tone: Tone;
  /** Shown under the value. */
  note?: string;
  /** The analysed point itself. */
  isCentre?: boolean;
  /** The highest-scoring cell. */
  isBest?: boolean;
}

/**
 * The nine-point opportunity grid, laid out as it is on screen: north at the
 * top, the analysed point in the middle. A table rather than a chart, because
 * the reader's question is "which direction", and a 3×3 of directions answers it
 * without a legend.
 */
export function heatGrid(cells: readonly HeatCell[]): string {
  const boxes = cells
    .map((cell) => {
      const badge = cell.isBest ? '<span class="heat-flag">terbaik</span>' : '';
      const value =
        cell.value === null
          ? `<span class="heat-blank">${escapeHtml(cell.note ?? 'tidak dinilai')}</span>`
          : `<span class="heat-score">${escapeHtml(cell.value)}</span>${
              cell.note === undefined ? '' : `<span class="heat-note">${escapeHtml(cell.note)}</span>`
            }`;
      return `<div class="heat-cell${cell.isCentre === true ? ' heat-cell-centre' : ''}" style="background:${
        cell.value === null ? '#f8fafc' : TONE_WASH[cell.tone]
      };border-color:${cell.value === null ? RULE : TONE_INK[cell.tone]}">
        <span class="heat-dir">${escapeHtml(cell.label)}</span>
        ${value}
        ${badge}
      </div>`;
    })
    .join('');
  return `<div class="heat-grid">${boxes}</div><p class="heat-compass">Atas = utara</p>`;
}

/**
 * One bar split into parts, for a total broken down by distance zone. Segments
 * under a few per cent still get a hairline of width so a small count is not
 * silently rounded out of the picture.
 */
export function stackedBar(parts: readonly { label: string; value: number; color: string }[]): string {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total <= 0) return '<p class="muted">Tidak ada fasilitas yang terpetakan di sekitar titik ini.</p>';

  const fills = parts
    .filter((part) => part.value > 0)
    .map(
      (part) =>
        `<span style="width:${Math.max(1.5, (part.value / total) * 100).toFixed(1)}%;background:${part.color}"></span>`,
    )
    .join('');
  const keys = parts
    .map(
      (part) =>
        `<span class="key"><i style="background:${part.color}"></i>${escapeHtml(part.label)} · <strong>${escapeHtml(
          part.value.toLocaleString('id-ID'),
        )}</strong></span>`,
    )
    .join('');
  return `<div class="stack">${fills}</div><div class="stack-keys">${keys}</div>`;
}

/** A labelled position on a five-step scale, for a reading that is a word rather than a number. */
export function scaleMeter(steps: readonly string[], activeIndex: number, tone: Tone): string {
  const cells = steps
    .map((step, index) => {
      const active = index === activeIndex;
      return `<span class="meter-step" style="background:${active ? TONE_INK[tone] : TRACK};color:${
        active ? '#ffffff' : MUTED
      }">${escapeHtml(step)}</span>`;
    })
    .join('');
  return `<div class="meter">${cells}</div>`;
}
