import { BAND_THRESHOLDS, band, type Band } from '@gayatama/scoring';
import { bandTone, toneColor } from '../../lib/band-color';
import { BAND_LABELS } from '../../lib/copy';

/**
 * The five suitability bands laid out end to end, with a marker at the score.
 *
 * Built from BAND_THRESHOLDS rather than from numbers repeated here, so a
 * recalibration in the engine moves these boundaries too. A score on its own
 * ("75 · Cocok") gives a reader no sense of whether that sits near the top of
 * the range or in the middle; this does.
 */
const SEGMENTS: { band: Band; from: number; to: number }[] = [
  { band: 'not_recommended', from: 0, to: BAND_THRESHOLDS.risky },
  { band: 'risky', from: BAND_THRESHOLDS.risky, to: BAND_THRESHOLDS.moderatelySuitable },
  { band: 'moderately_suitable', from: BAND_THRESHOLDS.moderatelySuitable, to: BAND_THRESHOLDS.suitable },
  { band: 'suitable', from: BAND_THRESHOLDS.suitable, to: BAND_THRESHOLDS.highlySuitable },
  { band: 'highly_suitable', from: BAND_THRESHOLDS.highlySuitable, to: 100 },
];

export function ScoreScale({ value }: { value: number }) {
  const active = band(value);
  const position = Math.min(100, Math.max(0, value));

  return (
    <div className="score-scale">
      <div
        className="meter-track"
        role="img"
        aria-label={`Skor ${Math.round(value)} dari 100, masuk kategori ${BAND_LABELS[active]}`}
      >
        {SEGMENTS.map((segment) => (
          <span
            key={segment.band}
            className="meter-zone"
            // The band the score falls in is inked fully; the rest stay muted,
            // so the bar says "you are here" even before you find the marker.
            style={{
              width: `${segment.to - segment.from}%`,
              background: toneColor(bandTone(segment.band)),
              opacity: segment.band === active ? 1 : undefined,
            }}
          />
        ))}
        <span className="meter-needle" style={{ left: `${position}%` }} />
      </div>

      {/* Each tick is placed at its own value. Spacing them evenly would put
          "60" nowhere near the boundary it names. */}
      <div className="scale-ticks" aria-hidden="true">
        {SEGMENTS.slice(1).map((segment) => (
          <span key={segment.from} className="scale-tick" style={{ left: `${segment.from}%` }}>
            {segment.from}
          </span>
        ))}
        <span className="scale-tick scale-tick-start">0</span>
        <span className="scale-tick scale-tick-end">100</span>
      </div>

    </div>
  );
}
