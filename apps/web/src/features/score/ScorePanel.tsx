import { COMPONENT_KEYS, confidenceReading } from '@gayatama/scoring';
import { Attribution, DataNotices, WarningList } from '../../components/Notices';
import type { AnalysisResponse, Factor } from '../../lib/api-types';
import {
  BAND_LABELS,
  BUSINESS_TYPE_LABELS,
  COMPONENT_DESCRIPTIONS,
  COMPONENT_LABELS,
  CONFIDENCE_LABELS,
} from '../../lib/copy';
import { displayScore, formatPercent, formatRange, formatWhole } from '../../lib/format';

interface ScorePanelProps {
  analysis: AnalysisResponse;
  /** Reloads the analysis; offered when part of the data could not be loaded. */
  onRefresh: () => void;
  refreshing: boolean;
}

export function ScorePanel({ analysis, onRefresh, refreshing }: ScorePanelProps) {
  const { score, dataSource } = analysis;

  return (
    <article className="score-card" aria-labelledby="score-heading">
      <header className="score-header">
        <p className="eyebrow">{BUSINESS_TYPE_LABELS[analysis.businessType]}</p>
        {/* Interface rule: a score is never shown without its interval. */}
        <h2 id="score-heading" className="score-value">
          {displayScore(score.value)}
          <span className="score-margin"> ± {score.margin}</span>
        </h2>
        <p className={`band band-${score.band}`}>{BAND_LABELS[score.band]}</p>
        <p className="muted">
          Likely range {formatRange(score)} · Confidence {formatWhole(score.confidence)}/100 (
          {CONFIDENCE_LABELS[confidenceReading(score.confidence)]})
        </p>
      </header>

      <DataNotices dataSource={dataSource} onRefresh={onRefresh} refreshing={refreshing} />
      <WarningList warnings={analysis.warnings} />

      <section className="section">
        <h3>Score breakdown</h3>
        <ul className="components">
          {COMPONENT_KEYS.map((key) => {
            const component = analysis.components[key];
            return (
              <li key={key} className="component">
                <div className="component-head">
                  <span className="component-label">
                    {COMPONENT_LABELS[key]} <span className="muted">· {formatPercent(component.weight)}</span>
                  </span>
                  <span className="component-value">{formatWhole(component.value)}</span>
                </div>
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, Math.min(100, component.value))}%` }} />
                </div>
                <p className="component-description">{COMPONENT_DESCRIPTIONS[key]}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <FactorList title="Strengths" factors={analysis.strengths} />
      <FactorList title="Weaknesses" factors={analysis.risks} />

      <section className="section">
        <h3>Evidence</h3>
        <p>
          {analysis.evidence.facilityCount} mapped facilities within 1.5 km — Zone A {analysis.evidence.zones.a}, Zone B{' '}
          {analysis.evidence.zones.b}, Zone C {analysis.evidence.zones.c}.
        </p>
      </section>

      <p className="disclaimer">
        A score supports a decision; it does not guarantee profit. Before investing, check the site on a weekday and a
        weekend: competitors, traffic, flooding, rent and legal status.
      </p>

      <Attribution dataSource={dataSource} modelVersion={analysis.modelVersion} />
    </article>
  );
}

function FactorList({ title, factors }: { title: string; factors: Factor[] }) {
  if (factors.length === 0) return null;
  return (
    <section className="section">
      <h3>{title}</h3>
      <ul className="factor-list">
        {factors.map((factor) => (
          <li key={factor.factor}>{factor.detail}</li>
        ))}
      </ul>
    </section>
  );
}
