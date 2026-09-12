import { COMPONENT_KEYS } from '@gayatama/scoring';
import { Card } from '../../components/Card';
import { Attribution, DataNotices, WarningList } from '../../components/Notices';
import type { AnalysisResponse, DataSource, Factor } from '../../lib/api-types';
import { scoreTone, toneColor } from '../../lib/band-color';
import { BUSINESS_TYPE_LABELS, COMPONENT_DESCRIPTIONS, COMPONENT_LABELS } from '../../lib/copy';
import { formatPercent, formatWhole } from '../../lib/format';
import { ScoreGauge } from './ScoreGauge';

interface ScorePanelProps {
  analysis: AnalysisResponse;
  /** Reloads the analysis; offered when part of the data could not be loaded. */
  onRefresh: () => void;
  refreshing: boolean;
}

export function ScorePanel({ analysis, onRefresh, refreshing }: ScorePanelProps) {
  const { score, dataSource } = analysis;

  // Each component contributes value × weight, and the five contributions sum
  // to the final score — so the reader can check where the number came from.
  const contributions = COMPONENT_KEYS.map((key) => {
    const { value, weight } = analysis.components[key];
    return { key, value, weight, contribution: value * weight };
  });
  const total = contributions.reduce((sum, entry) => sum + entry.contribution, 0);

  return (
    <article className="score-card">
      <ScoreGauge score={score} businessLabel={BUSINESS_TYPE_LABELS[analysis.businessType]} />

      <DataNotices dataSource={dataSource} onRefresh={onRefresh} refreshing={refreshing} />
      <WarningList warnings={analysis.warnings} />

      <Card title="Rincian skor" note="bobot × nilai">
        <ul className="components">
          {contributions.map(({ key, value, weight, contribution }) => (
            <li key={key} className="component">
              <div className="component-head">
                <span className="component-label">
                  {COMPONENT_LABELS[key]} <span className="muted">· {formatPercent(weight)}</span>
                </span>
                <span className="component-value" style={{ color: toneColor(scoreTone(value)) }}>
                  {formatWhole(value)}
                </span>
              </div>
              <div className="bar" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.max(0, Math.min(100, value))}%`,
                    ['--bar-color' as string]: toneColor(scoreTone(value)),
                  }}
                />
              </div>
              <p className="component-description">{COMPONENT_DESCRIPTIONS[key]}</p>
              <p className="component-contribution">
                Menyumbang {contribution.toFixed(1)} poin ke skor akhir
              </p>
            </li>
          ))}
        </ul>
        <p className="contribution-total">
          <span>Jumlah kelima kontribusi</span>
          <strong>{total.toFixed(1)}</strong>
        </p>
      </Card>

      <FactorList title="Kekuatan" factors={analysis.strengths} tone="excellent" />
      <FactorList title="Kelemahan" factors={analysis.risks} tone="poor" />

      <Card title="Bukti">
        <p>
          {analysis.evidence.facilityCount} fasilitas ditemukan dalam radius 1,5 km — Zona A{' '}
          {analysis.evidence.zones.a}, Zona B {analysis.evidence.zones.b}, Zona C {analysis.evidence.zones.c}.
        </p>
        <p className="muted">{sourceSummary(dataSource)}</p>
      </Card>

      <p className="disclaimer">
        Skor ini membantu mengambil keputusan, bukan jaminan untung. Sebelum berinvestasi, cek lokasinya langsung pada
        hari kerja dan akhir pekan: kompetitor, lalu lintas, banjir, sewa, dan legalitas.
      </p>

      <Attribution dataSource={dataSource} modelVersion={analysis.modelVersion} />
    </article>
  );
}

/** Which source each kind of facility came from. */
function sourceSummary(dataSource: DataSource): string {
  const shops = dataSource.overture === null ? 'OpenStreetMap' : 'OpenStreetMap dan Overture Maps';
  if (dataSource.places.status === 'used') {
    return `Usaha, sekolah, kantor, dan halte transportasi dihitung oleh Google Maps. Perumahan dan parkir dari OpenStreetMap; toko fotokopi, percetakan, dan ATK dari ${shops}.`;
  }
  if (dataSource.overture === null) return 'Semua fasilitas berasal dari OpenStreetMap.';
  return `Fasilitas berasal dari OpenStreetMap; toko fotokopi, percetakan, dan ATK dari ${shops}.`;
}

function FactorList({ title, factors, tone }: { title: string; factors: Factor[]; tone: 'excellent' | 'poor' }) {
  if (factors.length === 0) return null;
  return (
    <Card title={title}>
      <ul className="factor-list">
        {factors.map((factor) => (
          <li key={factor.factor}>
            <span className="factor-marker" style={{ ['--marker-color' as string]: `var(--tone-${tone})` }} />
            <span>{factor.detail}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
