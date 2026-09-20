import { ACCESSIBILITY_WEIGHTS, COMPONENT_KEYS } from '@gayatama/scoring';
import { Card } from '../../components/Card';
import { AlertIcon, CheckIcon } from '../../components/Icons';
import { Attribution, DataNotices, WarningList } from '../../components/Notices';
import type { AnalysisResponse, DataSource } from '../../lib/api-types';
import type { ComponentWeights } from '@gayatama/scoring';
import { toneColor } from '../../lib/band-color';
import { BAND_LABELS, BUSINESS_TYPE_LABELS, COMPONENT_LABELS } from '../../lib/copy';
import { formatPercent, formatRange, formatWhole } from '../../lib/format';
import { SimulationPanel } from '../simulate/SimulationPanel';
import { ScoreGauge } from './ScoreGauge';
import { WeightsEditor } from './WeightsEditor';
import { ReportExportButton } from './ReportExportButton';

interface ScorePanelProps {
  analysis: AnalysisResponse;
  onRefresh: () => void;
  refreshing: boolean;
  weights: ComponentWeights | null;
  onWeightsChange: (weights: ComponentWeights | null) => void;
}

export function ScorePanel({ analysis, onRefresh, refreshing, weights, onWeightsChange }: ScorePanelProps) {
  const { score, dataSource } = analysis;
  const contributions = COMPONENT_KEYS.map((key) => {
    const { value, weight } = analysis.components[key];
    return { key, value, weight, contribution: value * weight };
  });
  const total = contributions.reduce((sum, entry) => sum + entry.contribution, 0);

  const customWeights = analysis.weights !== undefined;

  return (
    <article className="score-card">
      {/* The only announcement of success. `QueryState` politely says the
          analysis has started and then nothing ever says it finished, so a
          screen reader user was left in silence at the moment the answer
          arrived. Visually hidden because the sighted equivalent is the gauge
          right below it. */}
      <p className="visually-hidden" role="status">
        Analisis selesai. Skor {formatWhole(score.value)} dari 100 untuk{' '}
        {BUSINESS_TYPE_LABELS[analysis.businessType]}, kategori {BAND_LABELS[score.band]}. Rentang kemungkinan{' '}
        {formatRange(score)}.
      </p>
      {customWeights && (
        <p className="notice custom-weights-notice" role="status">
          Skor ini dihitung dengan <strong>bobot ubahan</strong>, bukan bobot bawaan LOKABIS. Angkanya tidak setara
          dengan skor bawaan.
        </p>
      )}
      {/* One object. The number, its interval, its reliability and where the
          data came from belong together — a figure whose provenance sits at the
          bottom of a long scroll is a figure nobody can cite. */}
      <div className="score-object">
        <ScoreGauge score={score} businessLabel={BUSINESS_TYPE_LABELS[analysis.businessType]} />
        <Attribution dataSource={dataSource} modelVersion={analysis.modelVersion} />
      </div>

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
                        // A 0–1 scale factor, not a width: the bar is laid out
                        // full-width and scaled, so the fill animates on the
                        // compositor instead of relaying out five bars a frame.
                        ['--bar-fill' as string]: Math.max(0, Math.min(100, value)) / 100,
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

      {/* Three separate top-level blocks — the weights editor, the simulator and
          the evidence — became one. Each is a way of interrogating the model
          rather than reading its answer, so they belong behind one door at a
          predictable place instead of scattered through the scroll. The answer
          above is what most visitors came for; this is for the ones who want to
          argue with it. */}
      <details className="panel-disclosure model-disclosure">
        <summary>
          Bobot, simulasi &amp; data{' '}
          <span className="muted">· {customWeights ? 'bobot diubah' : 'bobot bawaan'}</span>
        </summary>
        <div className="disclosure-content">
          <WeightsEditor weights={weights} onChange={onWeightsChange} />
          <SimulationPanel analysis={analysis} />
          <div className="evidence-block">
            <p>{evidenceSummary(analysis.evidence.facilityCount)}</p>
            <p>{sourceSummary(dataSource)}</p>
            <p className="muted">
              {analysis.evidence.facilityCount.toLocaleString('id-ID')} fasilitas dalam radius 1,5 km: sangat dekat{' '}
              {analysis.evidence.zones.a.toLocaleString('id-ID')}, cukup dekat{' '}
              {analysis.evidence.zones.b.toLocaleString('id-ID')}, dan area terluar{' '}
              {analysis.evidence.zones.c.toLocaleString('id-ID')}.
            </p>
          </div>
        </div>
      </details>

      <ReportExportButton analysis={analysis} />
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
      {/* The "Ringkasan" eyebrow above this heading is gone. A label that only
          restates what the heading already is adds a line and no information. */}
      <h2>{narrative.headline}</h2>
      <p>{narrative.summary}</p>

      {/* Lifted out of the fold. This is the one part a visitor can act on, and
          it was opt-in behind a summary most people never press — worst of all
          on a low score, where the way forward is the whole point. */}
      {narrative.nextSteps.length > 0 && (
        <div className="next-steps">
          <h3>Langkah selanjutnya</h3>
          <ol>{narrative.nextSteps.map((item) => <li key={item}>{item}</li>)}</ol>
        </div>
      )}

      {/* Also out of the fold, and deliberately next to the verdict rather than
          buried with the data notes: the caveat belongs beside the claim it
          qualifies, not three folds away from it. */}
      <p className="disclaimer">
        Skor membantu membandingkan lokasi, bukan menjamin keuntungan. Cek sewa, banjir, legalitas, lalu lintas, dan
        kondisi lapangan sebelum berinvestasi.
      </p>

      <details className="panel-disclosure decision-details">
        <summary>Alasan lengkap</summary>
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
