import { Attribution, StaleDataNotice } from '../../components/Notices';
import type { AnalysisResponse } from '../../lib/api-types';
import { BUSINESS_TYPE_LABELS, DENSITY_LABELS, FACILITY_KIND_LABELS, SATURATION_LABELS } from '../../lib/copy';
import { formatDistance } from '../../lib/format';

export function CompetitionView({ analysis }: { analysis: AnalysisResponse }) {
  const { competition } = analysis;
  const businessLabel = BUSINESS_TYPE_LABELS[analysis.businessType];

  return (
    <div className="competition">
      {analysis.dataSource.stale && <StaleDataNotice fetchedAt={analysis.dataSource.fetchedAt} />}

      <dl className="stats">
        <div>
          <dt>Competitor equivalents</dt>
          <dd>{competition.equivalentCount.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Mapped within {formatDistance(competition.radiusMeters)}</dt>
          <dd>{competition.rawCount}</dd>
        </div>
        <div>
          <dt>Density</dt>
          <dd>{DENSITY_LABELS[competition.density]}</dd>
        </div>
        <div>
          <dt>Saturation ratio</dt>
          <dd>
            {competition.saturationRatio.toFixed(2)} · {SATURATION_LABELS[competition.reading]}
          </dd>
        </div>
      </dl>

      <p className="muted">
        A raw shop count is not the measure. Each business is weighted by distance, data freshness, opening hours, how
        closely it competes with a {businessLabel.toLowerCase()} and its size. The saturation ratio compares that total
        with the demand this location has for the business.
      </p>

      {competition.equivalentCount === 0 && (
        <p className="notice">
          No competitors are mapped nearby. GAYATAMA treats this as unproven demand rather than an open market, so the
          Competition Opportunity score is reduced.
        </p>
      )}

      {competition.strongest.length > 0 && (
        <section className="section">
          <h3>Strongest competitors</h3>
          <ul className="competitor-list">
            {competition.strongest.map((competitor) => (
              <li key={competitor.id}>
                <div>
                  <span className="competitor-name">{competitor.name ?? FACILITY_KIND_LABELS[competitor.kind]}</span>
                  <span className="muted">
                    {FACILITY_KIND_LABELS[competitor.kind]} · {formatDistance(competitor.distanceMeters)}
                  </span>
                </div>
                <span className="competitor-weight">counts as {competitor.contribution.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="disclaimer">
        Businesses that closed without the map being updated still count, and many small businesses are never mapped.
        Check the competition on site.
      </p>

      <Attribution dataSource={analysis.dataSource} />
    </div>
  );
}
