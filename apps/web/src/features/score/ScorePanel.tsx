import { ACCESSIBILITY_WEIGHTS, COMPONENT_KEYS } from '@gayatama/scoring';
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../../components/Card';
import { AlertIcon, CheckIcon } from '../../components/Icons';
import { Attribution, DataNotices, WarningList } from '../../components/Notices';
import { fetchSimulation } from '../../lib/api';
import type { AnalysisResponse, DataSource, SimulationResponse } from '../../lib/api-types';
import { toneColor } from '../../lib/band-color';
import { BUSINESS_TYPE_LABELS, COMPONENT_LABELS } from '../../lib/copy';
import { formatPercent } from '../../lib/format';
import { USE_GOOGLE_MAP } from '../../lib/map-config';
import { ScoreGauge } from './ScoreGauge';
import { ReportExportButton } from './ReportExportButton';

interface ScorePanelProps {
  analysis: AnalysisResponse;
  onRefresh: () => void;
  refreshing: boolean;
}

export function ScorePanel({ analysis, onRefresh, refreshing }: ScorePanelProps) {
  const { score, dataSource } = analysis;
  const contributions = COMPONENT_KEYS.map((key) => {
    const { value, weight } = analysis.components[key];
    return { key, value, weight, contribution: value * weight };
  });
  const total = contributions.reduce((sum, entry) => sum + entry.contribution, 0);

  return (
    <article className="score-card">
      <ScoreGauge score={score} businessLabel={BUSINESS_TYPE_LABELS[analysis.businessType]} />
      <ReportExportButton analysis={analysis} />
      <DecisionSummary analysis={analysis} />

      <DataNotices dataSource={dataSource} onRefresh={onRefresh} refreshing={refreshing} />
      <WarningList warnings={analysis.warnings} />

      <Card title="Faktor utama" note="5 indikator">
        <ul className="components">
          {contributions.map(({ key, value }) => {
            const availability = analysis.components[key].availability;
            const reading = componentReading(value, availability);
            return (
              <li key={key} className="component">
                <div className="component-head">
                  <span className="component-label">{COMPONENT_LABELS[key]}</span>
                  <span className="factor-reading">{reading.label}</span>
                </div>
                {availability !== 'unavailable' && (
                  <div className="bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.max(0, Math.min(100, value))}%`,
                        ['--bar-color' as string]: toneColor(reading.tone),
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <details className="calculation-details">
          <summary>Cara skor dihitung</summary>
          <div className="disclosure-content">
            <p>Setiap indikator dikalikan bobotnya, lalu seluruh hasil dijumlahkan.</p>
            <ul>
              {contributions.map(({ key, value, weight, contribution }) => (
                <li key={key}>
                  <span>{COMPONENT_LABELS[key]}</span>
                  <span>
                    {analysis.components[key].availability === 'unavailable' ? 'netral ' : ''}
                    {formatCalculationNumber(value)} × {formatPercent(weight)} = {formatCalculationNumber(contribution)}
                  </span>
                </li>
              ))}
            </ul>
            <AccessibilityCalculation analysis={analysis} />
            <p className="contribution-total">
              <span>Total sebelum pembulatan</span>
              <strong>{formatCalculationNumber(total)}</strong>
            </p>
          </div>
        </details>
      </Card>

      <WhatIfSimulator analysis={analysis} />

      <details className="panel-disclosure data-disclosure">
        <summary>Data & cara penilaian</summary>
        <div className="disclosure-content">
          <p>{evidenceSummary(analysis.evidence.facilityCount)}</p>
          <p>{sourceSummary(dataSource)}</p>
          <p className="muted">
            {analysis.evidence.facilityCount.toLocaleString('id-ID')} fasilitas dalam radius 1,5 km: sangat dekat{' '}
            {analysis.evidence.zones.a.toLocaleString('id-ID')}, cukup dekat{' '}
            {analysis.evidence.zones.b.toLocaleString('id-ID')}, dan area terluar{' '}
            {analysis.evidence.zones.c.toLocaleString('id-ID')}.
          </p>
          <p className="disclaimer">
            Skor membantu membandingkan lokasi, bukan menjamin keuntungan. Cek sewa, banjir, legalitas, lalu lintas,
            dan kondisi lapangan sebelum berinvestasi.
          </p>
        </div>
      </details>

      <Attribution dataSource={dataSource} modelVersion={analysis.modelVersion} />
    </article>
  );
}

function WhatIfSimulator({ analysis }: { analysis: AnalysisResponse }) {
  const [parking, setParking] = useState('0');
  const [useHours, setUseHours] = useState(false);
  const [opensAt, setOpensAt] = useState('08:00');
  const [closesAt, setClosesAt] = useState('22:00');
  const simulation = useMutation({
    mutationFn: (options: { onSiteParkingSpaces: number; openingHours?: { day: number; from: number; to: number }[] }) =>
      fetchSimulation(analysis.location, analysis.businessType, options, USE_GOOGLE_MAP),
  });
  const openingMinutes = timeToMinutes(opensAt);
  const closingMinutes = timeToMinutes(closesAt);
  const validHours = !useHours || (openingMinutes !== null && closingMinutes !== null && closingMinutes > openingMinutes);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validHours) return;
    const spaces = Math.max(0, Math.min(500, Math.round(Number(parking) || 0)));
    simulation.mutate({
      onSiteParkingSpaces: spaces,
      ...(useHours && openingMinutes !== null && closingMinutes !== null
        ? { openingHours: Array.from({ length: 7 }, (_, day) => ({ day, from: openingMinutes, to: closingMinutes })) }
        : {}),
    });
  };

  return (
    <Card title="Coba skenario" note="Tidak mengubah skor asli">
      <p className="muted">Uji dampak parkir di lokasi dan jam operasional yang sama setiap hari.</p>
      <form className="simulation-form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Parkir di lokasi (slot)</span>
          <input type="number" min="0" max="500" value={parking} onChange={(event) => setParking(event.target.value)} />
        </label>
        <label className="simulation-check">
          <input type="checkbox" checked={useHours} onChange={(event) => setUseHours(event.target.checked)} />
          Gunakan jam buka sendiri
        </label>
        {useHours && (
          <div className="simulation-hours">
            <label className="field">
              <span className="field-label">Buka</span>
              <input type="time" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Tutup</span>
              <input type="time" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
            </label>
          </div>
        )}
        {!validHours && <p className="notice" role="alert">Jam tutup harus setelah jam buka.</p>}
        <button type="submit" className="button-secondary" disabled={simulation.isPending || !validHours}>
          {simulation.isPending ? 'Menghitung skenario…' : 'Bandingkan skenario'}
        </button>
      </form>
      {simulation.isError && <p className="notice" role="alert">Skenario belum bisa dihitung. Coba lagi sebentar.</p>}
      {simulation.data !== undefined && <SimulationResult result={simulation.data} />}
    </Card>
  );
}

function SimulationResult({ result }: { result: SimulationResponse }) {
  const change = result.scoreChange;
  return (
    <div className="simulation-result" role="status">
      <strong>
        {result.baseline.score.value.toFixed(1)} → {result.simulated.score.value.toFixed(1)}
        {' '}({change >= 0 ? '+' : ''}{change.toFixed(1)} poin)
      </strong>
      <span>
        Akses {result.baseline.accessibility.value.toFixed(1)} → {result.simulated.accessibility.value.toFixed(1)} · Persaingan{' '}
        {result.baseline.competition.value.toFixed(1)} → {result.simulated.competition.value.toFixed(1)}
      </span>
    </div>
  );
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : null;
}

function AccessibilityCalculation({ analysis }: { analysis: AnalysisResponse }) {
  const accessibility = (analysis as Partial<AnalysisResponse>).accessibility;
  if (accessibility === undefined) {
    return <p className="muted">Rincian akses belum tersedia. Muat ulang setelah API selesai diperbarui.</p>;
  }
  const neutralNote = accessibility.siteInputsAvailable ? '' : ' (netral karena data gagal dimuat)';
  return (
    <p className="muted">
      Rincian akses: jalan {formatCalculationNumber(accessibility.road)}{neutralNote} ×{' '}
      {formatPercent(ACCESSIBILITY_WEIGHTS.road)} + transportasi {formatCalculationNumber(accessibility.transit)} ×{' '}
      {formatPercent(ACCESSIBILITY_WEIGHTS.transit)} + jalan kaki {formatCalculationNumber(accessibility.walkability)}
      {neutralNote} × {formatPercent(ACCESSIBILITY_WEIGHTS.walkability)} + parkir{' '}
      {formatCalculationNumber(accessibility.parking)} × {formatPercent(ACCESSIBILITY_WEIGHTS.parking)} ={' '}
      {formatCalculationNumber(accessibility.value)}.
    </p>
  );
}

function DecisionSummary({ analysis }: { analysis: AnalysisResponse }) {
  const { narrative } = analysis;
  const generatedByAi = narrative.generatedBy === 'ai';
  return (
    <section className={`decision-summary${narrative.provisional ? ' decision-summary-provisional' : ''}`}>
      <span className="eyebrow">Ringkasan</span>
      <h2>{narrative.headline}</h2>
      <p>{narrative.summary}</p>

      <details className="panel-disclosure decision-details">
        <summary>Alasan & langkah berikutnya</summary>
        <div className="disclosure-content">
          <p className="ai-explanation-note">
            {generatedByAi
              ? 'AI hanya merangkum hasil. Nilai skor tetap dihitung oleh model LOKABIS dari data lokasi.'
              : 'Ringkasan dibuat otomatis dari data lokasi dan hasil perhitungan LOKABIS.'}
          </p>

          <div className="decision-columns">
            {narrative.positives.length > 0 && (
              <div>
                <h3><CheckIcon size={17} /> Yang mendukung</h3>
                <ul>{narrative.positives.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            )}
            {narrative.cautions.length > 0 && (
              <div>
                <h3><AlertIcon size={17} /> Perlu diperiksa</h3>
                <ul>{narrative.cautions.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            )}
          </div>

          {narrative.nextSteps.length > 0 && (
            <div className="next-steps">
              <h3>Langkah selanjutnya</h3>
              <ol>{narrative.nextSteps.map((item) => <li key={item}>{item}</li>)}</ol>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

function componentReading(
  value: number,
  availability: AnalysisResponse['components'][keyof AnalysisResponse['components']]['availability'],
) {
  if (availability === 'unavailable') return { label: 'Belum dinilai', tone: 'neutral' as const };
  const suffix = availability === 'partial' ? ' · sebagian' : '';
  if (value >= 80) return { label: `Sangat kuat${suffix}`, tone: 'excellent' as const };
  if (value >= 65) return { label: `Kuat${suffix}`, tone: 'good' as const };
  if (value >= 50) return { label: `Cukup${suffix}`, tone: 'fair' as const };
  if (value >= 35) return { label: `Lemah${suffix}`, tone: 'poor' as const };
  return { label: `Sangat lemah${suffix}`, tone: 'bad' as const };
}

function formatCalculationNumber(value: number): string {
  if (value > 0 && value < 0.1) return '<0,1';
  return value.toLocaleString('id-ID', { maximumFractionDigits: 1 });
}

function evidenceSummary(count: number): string {
  if (count >= 1000) return 'Cakupan data di sekitar lokasi sangat banyak.';
  if (count >= 100) return 'Cakupan data di sekitar lokasi cukup banyak.';
  return 'Cakupan data masih terbatas; hasil perlu diverifikasi langsung.';
}

function sourceSummary(dataSource: DataSource): string {
  const shops = dataSource.overture === null ? 'OpenStreetMap' : 'OpenStreetMap dan Overture Maps';
  if (dataSource.places.status === 'used') {
    return `Usaha, sekolah, kantor, dan transportasi dihitung oleh Google Maps. Data lainnya berasal dari OpenStreetMap; fotokopi dan ATK dari ${shops}.`;
  }
  if (dataSource.overture === null) return 'Semua fasilitas berasal dari OpenStreetMap.';
  return `Fasilitas berasal dari OpenStreetMap; fotokopi dan ATK dari ${shops}.`;
}
