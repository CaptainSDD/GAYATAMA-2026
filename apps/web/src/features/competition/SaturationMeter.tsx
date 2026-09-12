import { SATURATION_THRESHOLDS, type SaturationReading } from '@gayatama/scoring';
import { saturationTone, toneChip, toneColor, type Tone } from '../../lib/band-color';
import { SATURATION_LABELS } from '../../lib/copy';

/** Where the scale stops. Past 2.0 the engine says "heavily saturated" anyway. */
const SCALE_MAX = 2.5;

/**
 * The five readings as bands on a 0–SCALE_MAX scale, built from the engine's
 * own thresholds so the picture cannot disagree with the verdict.
 */
const ZONES: { reading: SaturationReading; from: number; to: number }[] = [
  { reading: 'not_saturated', from: 0, to: SATURATION_THRESHOLDS.healthy },
  { reading: 'healthy', from: SATURATION_THRESHOLDS.healthy, to: SATURATION_THRESHOLDS.becomingSaturated },
  {
    reading: 'becoming_saturated',
    from: SATURATION_THRESHOLDS.becomingSaturated,
    to: SATURATION_THRESHOLDS.saturated,
  },
  { reading: 'saturated', from: SATURATION_THRESHOLDS.saturated, to: SATURATION_THRESHOLDS.heavilySaturated },
  { reading: 'heavily_saturated', from: SATURATION_THRESHOLDS.heavilySaturated, to: SCALE_MAX },
];

interface SaturationMeterProps {
  ratio: number;
  reading: SaturationReading;
}

/**
 * Saturation as a position on a scale rather than a bare number. "0.55 ·
 * persaingan sehat" only means something once you can see where 0.55 falls
 * between an empty market and a crowded one.
 */
export function SaturationMeter({ ratio, reading }: SaturationMeterProps) {
  const tone: Tone = saturationTone(reading);
  const needlePercent = Math.min(100, Math.max(0, (ratio / SCALE_MAX) * 100));

  return (
    <div className="meter">
      <div className="meter-head">
        <span className="component-label">Rasio kejenuhan</span>
        <span className="meter-value" style={{ color: toneColor(tone) }}>
          {ratio.toFixed(2)}
        </span>
      </div>

      <div className="meter-track" role="presentation" aria-hidden="true">
        {ZONES.map((zone) => (
          <span
            key={zone.reading}
            className="meter-zone"
            style={{
              width: `${((zone.to - zone.from) / SCALE_MAX) * 100}%`,
              background: toneColor(saturationTone(zone.reading)),
            }}
          />
        ))}
        <span className="meter-needle" style={{ left: `${needlePercent}%` }} />
      </div>

      <div className="meter-scale" aria-hidden="true">
        <span>0</span>
        <span>0,5</span>
        <span>1,0</span>
        <span>1,5</span>
        <span>2,0+</span>
      </div>

      <p>
        <span className={toneChip(tone)}>{SATURATION_LABELS[reading]}</span>
      </p>
    </div>
  );
}
