import { SEGMENT_WEIGHTS, SEGMENTS, type LatLng } from '@gayatama/scoring';
import { Attribution, StaleDataNotice } from '../../components/Notices';
import type { AnalysisResponse } from '../../lib/api-types';
import { BUSINESS_TYPE_LABELS, FACILITY_KIND_LABELS, SEGMENT_LABELS, SEGMENT_ROLE_LABELS } from '../../lib/copy';
import { segmentEvidence, type KindCount } from '../../lib/evidence';
import { formatPercent, formatWhole } from '../../lib/format';
import { usePois } from '../../lib/queries';

interface SegmentsViewProps {
  analysis: AnalysisResponse;
  point: LatLng;
}

export function SegmentsView({ analysis, point }: SegmentsViewProps) {
  const pois = usePois(point);
  const evidence = pois.data === undefined ? null : segmentEvidence(pois.data.facilities);
  const businessLabel = BUSINESS_TYPE_LABELS[analysis.businessType];
  const weights = SEGMENT_WEIGHTS[analysis.businessType];
  const ordered = [...SEGMENTS].sort((a, b) => analysis.segments[b].score - analysis.segments[a].score);

  const evidenceText = (kinds: KindCount[] | undefined): string => {
    if (pois.isError) return 'The facility list behind this score could not be loaded.';
    if (kinds === undefined) return 'Loading the facilities behind this score…';
    if (kinds.length === 0) return 'No mapped facilities indicate this group.';
    return `Mapped nearby: ${kinds.map(({ kind, count }) => `${FACILITY_KIND_LABELS[kind]} ×${count}`).join(', ')}`;
  };

  return (
    <div className="segments">
      <p className="muted">
        How strong each customer group is around this location, judged from facilities mapped within 1.5 km. These
        are strength indicators, not population counts: GAYATAMA has no demographic data and does not estimate any.
      </p>

      {analysis.dataSource.stale && <StaleDataNotice fetchedAt={analysis.dataSource.fetchedAt} />}

      <ul className="segment-list">
        {ordered.map((segment) => {
          const { score, role } = analysis.segments[segment];
          const weight = weights[segment];
          return (
            <li key={segment} className="segment">
              <div className="component-head">
                <span className="component-label">{SEGMENT_LABELS[segment]}</span>
                <span className="component-value">{formatWhole(score)}</span>
              </div>
              <div className="bar" aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
              </div>
              <p className="segment-meta">
                <span className={`role role-${role}`}>{SEGMENT_ROLE_LABELS[role]}</span>
                {score >= 100 && ' · capped at 100'}
                {' · '}
                {weight > 0
                  ? `${formatPercent(weight)} of ${businessLabel}’s Demand Fit`
                  : `Not part of ${businessLabel}’s Demand Fit`}
              </p>
              <p className="component-description">{evidenceText(evidence?.[segment])}</p>
            </li>
          );
        })}
      </ul>

      <Attribution dataSource={analysis.dataSource} />
    </div>
  );
}
