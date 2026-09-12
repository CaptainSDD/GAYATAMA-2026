import { confidenceReading, type ScoreSummary } from '@gayatama/scoring';
import { bandTone, confidenceTone, toneChip, toneColor } from '../../lib/band-color';
import { BAND_LABELS, CONFIDENCE_LABELS } from '../../lib/copy';
import { displayScore, formatRange, formatWhole } from '../../lib/format';
import { ScoreScale } from './ScoreScale';

// Geometry: a 270° arc opening at the bottom, so 0 and 100 sit either side of
// the gap and the reading runs clockwise.
const START_ANGLE = 135;
const SWEEP = 270;
const RADIUS = 80;
const CENTRE = 100;
const STROKE = 14;

function pointAt(angleDegrees: number): [number, number] {
  const radians = (angleDegrees * Math.PI) / 180;
  return [CENTRE + RADIUS * Math.cos(radians), CENTRE + RADIUS * Math.sin(radians)];
}

/** SVG path for the arc covering `from`–`to` on the 0–100 scale. */
function arcPath(from: number, to: number): string {
  const clampedFrom = Math.max(0, Math.min(100, from));
  const clampedTo = Math.max(0, Math.min(100, to));
  const startAngle = START_ANGLE + (clampedFrom / 100) * SWEEP;
  const endAngle = START_ANGLE + (clampedTo / 100) * SWEEP;
  const [x1, y1] = pointAt(startAngle);
  const [x2, y2] = pointAt(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/**
 * The headline score, drawn so the uncertainty is part of the picture rather
 * than a footnote: the translucent band is the likely range, the solid arc runs
 * to the score itself, and the tick marks the exact value.
 *
 * The SVG is decorative — `aria-hidden` — because every number it encodes is
 * also present as text below it.
 */
export function ScoreGauge({ score, businessLabel }: { score: ScoreSummary; businessLabel: string }) {
  const tone = bandTone(score.band);
  const reading = confidenceReading(score.confidence);
  const [low, high] = score.range;
  const needleAngle = START_ANGLE + (Math.max(0, Math.min(100, score.value)) / 100) * SWEEP;
  const [needleX, needleY] = pointAt(needleAngle);
  const [needleInnerX, needleInnerY] = [
    CENTRE + (RADIUS - STROKE) * Math.cos((needleAngle * Math.PI) / 180),
    CENTRE + (RADIUS - STROKE) * Math.sin((needleAngle * Math.PI) / 180),
  ];

  return (
    <section className="gauge-card" aria-labelledby="score-heading">
      <p className="gauge-business">{businessLabel}</p>

      <div className="gauge">
        <svg viewBox="0 0 200 180" role="presentation" aria-hidden="true">
          <path
            className="gauge-track"
            d={arcPath(0, 100)}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* The likely range, 67–83 in the worked example. */}
          <path
            className="gauge-interval"
            d={arcPath(low, high)}
            fill="none"
            stroke={toneColor(tone)}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          <path
            className="gauge-arc"
            d={arcPath(0, score.value)}
            fill="none"
            stroke={toneColor(tone)}
            strokeWidth={STROKE / 2.5}
            strokeLinecap="round"
          />
          <line
            x1={needleInnerX}
            y1={needleInnerY}
            x2={needleX}
            y2={needleY}
            stroke="var(--text)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </svg>

        <div className="gauge-centre">
          {/* Interface rule: the score never appears without its interval. */}
          <p id="score-heading" className="gauge-value">
            {displayScore(score.value)}
            <span className="gauge-margin">± {score.margin}</span>
          </p>
          <p className="gauge-scale">dari 100</p>
        </div>
      </div>

      <div className="gauge-meta">
        <p className={toneChip(tone) + ' chip-lg'}>{BAND_LABELS[score.band]}</p>
        <p className="gauge-range">
          Rentang kemungkinan {formatRange(score)}
        </p>
        <ScoreScale value={score.value} />
        <p className="muted">
          Keyakinan {formatWhole(score.confidence)}/100 ·{' '}
          <span style={{ color: toneColor(confidenceTone(reading)), fontWeight: 650 }}>
            {CONFIDENCE_LABELS[reading]}
          </span>
        </p>
      </div>
    </section>
  );
}
