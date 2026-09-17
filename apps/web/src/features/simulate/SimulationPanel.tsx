import type { OperatorOptions } from '@gayatama/scoring';
import { useState } from 'react';
import { Card } from '../../components/Card';
import { QueryError } from '../../components/QueryState';
import type { AnalysisResponse, SimulationResponse } from '../../lib/api-types';
import { scoreTone, toneChip } from '../../lib/band-color';
import { BAND_LABELS } from '../../lib/copy';
import { displayScore } from '../../lib/format';
import { useSimulation } from '../../lib/queries';
import { toMinutes, weeklyHours } from './hours';

const DEFAULT_OPEN = '08:00';
const DEFAULT_CLOSE = '17:00';
const MAX_PARKING_SPACES = 30;

/**
 * What-if: rescores this location with the two things an owner actually
 * controls. The engine is the only thing that scores; this panel sends the
 * changes and reports the difference it made.
 */
export function SimulationPanel({ analysis }: { analysis: AnalysisResponse }) {
  const [parking, setParking] = useState(0);
  const [hoursOn, setHoursOn] = useState(false);
  const [openAt, setOpenAt] = useState(DEFAULT_OPEN);
  const [closeAt, setCloseAt] = useState(DEFAULT_CLOSE);
  const [applied, setApplied] = useState<OperatorOptions | null>(null);

  const simulation = useSimulation(analysis.location, analysis.businessType, applied);

  const from = toMinutes(openAt);
  const to = toMinutes(closeAt);
  const hours = from === null || to === null ? null : weeklyHours(from, to);
  const hoursInvalid = hoursOn && hours === null;
  const nothingToApply = parking === 0 && !hoursOn;

  const apply = () => {
    const options: OperatorOptions = {};
    if (parking > 0) options.onSiteParkingSpaces = parking;
    if (hoursOn && hours !== null) options.openingHours = hours;
    setApplied(options);
  };

  const reset = () => {
    setParking(0);
    setHoursOn(false);
    setOpenAt(DEFAULT_OPEN);
    setCloseAt(DEFAULT_CLOSE);
    setApplied(null);
  };

  return (
    <Card title="Simulasi bagaimana jika" note="yang bisa Anda ubah sendiri">
      <p className="lead">
        Skor di atas menilai lokasinya apa adanya. Di sini Anda bisa mencoba dua hal yang ada di tangan Anda, lalu
        melihat seberapa jauh keduanya menggeser skor.
      </p>

      <div className="simulate-controls">
        <div className="field">
          <label className="field-label" htmlFor="sim-parking">
            Parkir sendiri di lokasi
          </label>
          <div className="simulate-slider">
            <input
              id="sim-parking"
              type="range"
              min={0}
              max={MAX_PARKING_SPACES}
              step={1}
              value={parking}
              onChange={(event) => setParking(Number(event.target.value))}
            />
            <output htmlFor="sim-parking">{parking === 0 ? 'tidak ada' : `${parking} petak`}</output>
          </div>
          <p className="muted">Menambah petak parkir menaikkan Kemudahan Akses.</p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sim-hours-on">
            Jam buka sendiri
          </label>
          <label className="simulate-toggle">
            <input
              id="sim-hours-on"
              type="checkbox"
              checked={hoursOn}
              onChange={(event) => setHoursOn(event.target.checked)}
            />
            <span>Tentukan jam buka, setiap hari sama</span>
          </label>
          {hoursOn && (
            <div className="simulate-hours">
              <input
                type="time"
                className="text-input"
                aria-label="Jam buka"
                value={openAt}
                onChange={(event) => setOpenAt(event.target.value)}
              />
              <span aria-hidden="true">–</span>
              <input
                type="time"
                className="text-input"
                aria-label="Jam tutup"
                value={closeAt}
                onChange={(event) => setCloseAt(event.target.value)}
              />
            </div>
          )}
          <p className="muted">
            Pesaing yang tutup saat Anda buka lebih sedikit menekan skor Persaingan. Jam lewat tengah malam belum bisa
            disimulasikan.
          </p>
          {hoursInvalid && <p className="field-error">Jam tutup harus lebih malam daripada jam buka.</p>}
        </div>
      </div>

      <div className="simulate-actions">
        <button type="button" className="button-primary" onClick={apply} disabled={nothingToApply || hoursInvalid}>
          Hitung ulang
        </button>
        {applied !== null && (
          <button type="button" className="button-secondary" onClick={reset}>
            Kembali ke awal
          </button>
        )}
      </div>

      {nothingToApply && applied === null && (
        <p className="muted">Ubah salah satu di atas untuk mulai menghitung.</p>
      )}

      {simulation.isPending && applied !== null && (
        <p className="notice" role="status">
          Menghitung ulang skor dengan perubahan Anda…
        </p>
      )}
      {simulation.isError && <QueryError error={simulation.error} onRetry={() => void simulation.refetch()} />}
      {simulation.isSuccess && <SimulationResult result={simulation.data} />}
    </Card>
  );
}

function SimulationResult({ result }: { result: SimulationResponse }) {
  const { baseline, simulated, scoreChange } = result;
  const rounded = Math.round(scoreChange * 10) / 10;
  const direction = rounded > 0 ? 'naik' : rounded < 0 ? 'turun' : 'tetap';
  const changeTone = rounded > 0 ? 'excellent' : rounded < 0 ? 'bad' : 'neutral';

  return (
    <div className="simulate-result">
      <div className="simulate-scores">
        <div>
          <span className="eyebrow">Sekarang</span>
          <strong>{displayScore(baseline.score.value)}</strong>
          <span className="muted">{BAND_LABELS[baseline.score.band]}</span>
        </div>
        <span className="simulate-arrow" aria-hidden="true">
          →
        </span>
        <div>
          <span className="eyebrow">Dengan perubahan</span>
          <strong style={{ color: `var(--tone-${scoreTone(simulated.score.value)})` }}>
            {displayScore(simulated.score.value)}
          </strong>
          <span className="muted">{BAND_LABELS[simulated.score.band]}</span>
        </div>
      </div>

      <p className={toneChip(changeTone)}>
        Skor {direction}
        {rounded !== 0 && ` ${formatDelta(rounded)} poin`}
      </p>

      <ul className="simulate-moved">
        <MovedRow label="Kemudahan Akses" before={baseline.accessibility.value} after={simulated.accessibility.value} />
        <MovedRow label="Ketersediaan parkir" before={baseline.accessibility.parking} after={simulated.accessibility.parking} />
        <MovedRow label="Persaingan" before={baseline.competition.value} after={simulated.competition.value} />
      </ul>

      <p className="muted">
        Keyakinan tidak ikut berubah: parkir dan jam buka milik Anda tidak membuat data peta di sekitar jadi lebih
        lengkap.
      </p>
    </div>
  );
}

function MovedRow({ label, before, after }: { label: string; before: number; after: number }) {
  const delta = Math.round((after - before) * 10) / 10;
  return (
    <li>
      <span>{label}</span>
      <span>
        {displayScore(before)} → {displayScore(after)}
        {delta !== 0 && <span className="muted"> ({formatDelta(delta)})</span>}
      </span>
    </li>
  );
}

function formatDelta(value: number): string {
  const text = Math.abs(value).toLocaleString('id-ID', { maximumFractionDigits: 1 });
  return `${value > 0 ? '+' : '−'}${text}`;
}
