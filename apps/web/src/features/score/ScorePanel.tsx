import { ACCESSIBILITY_WEIGHTS, COMPONENT_KEYS } from '@gayatama/scoring';
import { Card } from '../../components/Card';
import { AlertIcon, CheckIcon } from '../../components/Icons';
import { Attribution, DataNotices, WarningList } from '../../components/Notices';
import type { AnalysisResponse, DataSource } from '../../lib/api-types';
import { toneColor } from '../../lib/band-color';
import { BUSINESS_TYPE_LABELS, COMPONENT_LABELS } from '../../lib/copy';
import { formatPercent } from '../../lib/format';
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

      <ReportExportButton analysis={analysis} />
      <Attribution dataSource={dataSource} modelVersion={analysis.modelVersion} />
    </article>
  );
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
