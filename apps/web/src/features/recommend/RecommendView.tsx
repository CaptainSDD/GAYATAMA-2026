import { BUSINESS_TYPES, type BusinessType } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { Attribution, DataNotices, WarningList } from '../../components/Notices';
import { Loading, QueryError } from '../../components/QueryState';
import { ScoreInline } from '../../components/ScoreInline';
import type { RecommendResponse } from '../../lib/api-types';
import { BUSINESS_TYPE_LABELS, SEGMENT_LABELS, STATUS_LABELS } from '../../lib/copy';

interface RecommendViewProps {
  query: UseQueryResult<RecommendResponse>;
  onAnalyse: (businessType: BusinessType) => void;
}

export function RecommendView({ query, onAnalyse }: RecommendViewProps) {
  if (query.isPending) return <Loading message="Scoring all seven business types…" />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const { recommendations, notRecommended, equivalent, warnings, dataSource, modelVersion } = query.data;
  const unlisted = BUSINESS_TYPES.length - recommendations.length - notRecommended.length;
  const needsValidation = recommendations.some((entry) => entry.status === 'needs_validation');
  const peersOf = (type: BusinessType) =>
    (equivalent.find((group) => group.includes(type)) ?? []).filter((other) => other !== type);

  return (
    <div className="recommend">
      <p className="muted">
        All seven business types, scored for this location. Up to three scoring 60 or more are recommended; types
        within 3 points of each other are equally suitable, not a strict ranking.
      </p>

      <DataNotices dataSource={dataSource} onRefresh={() => void query.refetch()} refreshing={query.isFetching} />
      <WarningList warnings={warnings} />

      {needsValidation && (
        <p className="notice">
          Data around this location is incomplete, so nothing here can be recommended with confidence. Treat these as
          leads to check on site.
        </p>
      )}

      {recommendations.length === 0 ? (
        <p className="notice">No business type scores 60 or more at this location.</p>
      ) : (
        <ol className="recommendation-list">
          {recommendations.map((entry) => {
            const peers = peersOf(entry.businessType);
            return (
              <li key={entry.businessType} className="recommendation">
                <div className="recommendation-head">
                  <h3>{BUSINESS_TYPE_LABELS[entry.businessType]}</h3>
                  <ScoreInline score={entry.score} />
                </div>
                <p className={`status status-${entry.status}`}>{STATUS_LABELS[entry.status]}</p>
                <p>{entry.rationale}.</p>
                <p className="muted">
                  Main customers: {SEGMENT_LABELS[entry.dominantSegment]}. {entry.differentiator}.
                </p>
                {peers.length > 0 && (
                  <p className="muted">
                    Within 3 points of {peers.map((peer) => BUSINESS_TYPE_LABELS[peer]).join(' and ')} — treat them as
                    equally suitable.
                  </p>
                )}
                <button type="button" className="button-link" onClick={() => onAnalyse(entry.businessType)}>
                  See the full analysis
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {unlisted > 0 && (
        <p className="muted">
          {unlisted === 1
            ? '1 more business type also scores 60 or more but ranks below the top three.'
            : `${unlisted} more business types also score 60 or more but rank below the top three.`}
        </p>
      )}

      {notRecommended.length > 0 && (
        <section className="section">
          <h3>Not recommended here</h3>
          <ul className="not-recommended">
            {notRecommended.map((entry) => (
              <li key={entry.businessType}>
                <div className="recommendation-head">
                  <span className="component-label">{BUSINESS_TYPE_LABELS[entry.businessType]}</span>
                  <ScoreInline score={entry.score} />
                </div>
                <p className="muted">{entry.reason}.</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Attribution dataSource={dataSource} modelVersion={modelVersion} />
    </div>
  );
}
