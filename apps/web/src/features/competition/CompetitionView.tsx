import { Attribution, StaleDataNotice } from '../../components/Notices';
import type { AnalysisResponse, Competitor } from '../../lib/api-types';
import { BUSINESS_TYPE_LABELS, DENSITY_LABELS, FACILITY_KIND_LABELS, SATURATION_LABELS } from '../../lib/copy';
import { formatDistance, formatZone } from '../../lib/format';

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
          <dt>Found within {formatDistance(competition.radiusMeters)}</dt>
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
          No competitors were found nearby. GAYATAMA treats this as unproven demand rather than an open market, so the
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
                  <span className="competitor-name">{competitorName(competitor)}</span>
                  <span className="muted">{competitorDetail(competitor)}</span>
                </div>
                <span className="competitor-weight">counts as {competitor.contribution.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="disclaimer">
        Some businesses that have closed may still be listed, and many small businesses appear on no map. Check the
        competition on site.
      </p>

      <Attribution dataSource={analysis.dataSource} />
    </div>
  );
}

function competitorName(competitor: Competitor): string {
  const label = FACILITY_KIND_LABELS[competitor.kind];
  if (competitor.distanceMeters === null) return `${competitor.count} × ${label}`;
  return competitor.name ?? label;
}

/** A counted group has no position, only the zone it lies in. */
function competitorDetail(competitor: Competitor): string {
  const label = FACILITY_KIND_LABELS[competitor.kind];
  if (competitor.distanceMeters === null) {
    const source = competitor.source === 'google' ? 'counted by Google Maps' : `counted by ${competitor.source}`;
    return `${formatZone(competitor.zone)} · ${source}`;
  }
  const source = competitor.source === 'overture' ? ' · from Overture Maps' : '';
  return `${label} · ${formatDistance(competitor.distanceMeters)}${source}`;
}
