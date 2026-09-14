import { BUSINESS_TYPES, type BusinessType } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { CompassIcon } from '../../components/Icons';
import { Attribution, DataNotices, WarningList } from '../../components/Notices';
import { QueryError } from '../../components/QueryState';
import { ScoreInline } from '../../components/ScoreInline';
import { ScoreSkeleton } from '../../components/Skeleton';
import type { RecommendResponse } from '../../lib/api-types';
import { BUSINESS_TYPE_LABELS, SEGMENT_LABELS } from '../../lib/copy';

interface RecommendViewProps {
  query: UseQueryResult<RecommendResponse>;
  onAnalyse: (businessType: BusinessType) => void;
}

export function RecommendView({ query, onAnalyse }: RecommendViewProps) {
  if (query.isPending) return <ScoreSkeleton />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const { recommendations, notRecommended, equivalent, warnings, dataSource, modelVersion } = query.data;
  const unlisted = BUSINESS_TYPES.length - recommendations.length - notRecommended.length;
  const needsValidation = recommendations.some((entry) => entry.status === 'needs_validation');
  const peersOf = (type: BusinessType) =>
    (equivalent.find((group) => group.includes(type)) ?? []).filter((other) => other !== type);

  return (
    <div className="recommend">
      <p className="lead">Pilihan usaha diurutkan berdasarkan kecocokannya dengan lokasi ini.</p>

      <DataNotices dataSource={dataSource} onRefresh={() => void query.refetch()} refreshing={query.isFetching} />
      <WarningList warnings={warnings} />

      {needsValidation && (
        <p className="notice">
          Data sekitar belum lengkap. Gunakan urutan ini sebagai petunjuk awal dan cek kondisi lapangan.
        </p>
      )}

      {recommendations.length === 0 ? (
        <p className="notice">Belum ada pilihan usaha dengan skor yang cukup kuat di lokasi ini.</p>
      ) : (
        <ol className="recommendation-list">
          {recommendations.map((entry, index) => {
            const peers = peersOf(entry.businessType);
            return (
              <li key={entry.businessType} className="recommendation">
                <div className="recommendation-head">
                  <h3>
                    <span className="recommendation-rank" aria-hidden="true">{index + 1}</span>
                    {BUSINESS_TYPE_LABELS[entry.businessType]}
                  </h3>
                  <ScoreInline score={entry.score} />
                </div>
                <p className="recommendation-status">
                  {recommendationLabel(entry.status, index, peers.length > 0)}
                </p>
                <p className="recommendation-rationale">{entry.rationale}</p>

                <details className="panel-disclosure recommendation-details">
                  <summary>Mengapa cocok?</summary>
                  <div className="disclosure-content">
                    <p>
                      Pelanggan utama: <strong>{SEGMENT_LABELS[entry.dominantSegment]}</strong>. {entry.differentiator}
                    </p>
                    {peers.length > 0 && (
                      <p className="equivalence">
                        <CompassIcon size={16} />
                        <span>
                          Skornya berdekatan dengan {peers.map((peer) => BUSINESS_TYPE_LABELS[peer]).join(' dan ')}.
                          Perlakukan pilihan ini sebagai sama-sama cocok.
                        </span>
                      </p>
                    )}
                  </div>
                </details>

                <button type="button" className="button-link" onClick={() => onAnalyse(entry.businessType)}>
                  Lihat skor lengkap
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {unlisted > 0 && <p className="muted">{unlisted} pilihan lain tersedia dalam laporan lengkap.</p>}

      {notRecommended.length > 0 && (
        <details className="card panel-disclosure not-recommended-disclosure">
          <summary>Tidak direkomendasikan ({notRecommended.length})</summary>
          <ul className="not-recommended disclosure-content">
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
        </details>
      )}

      <Attribution dataSource={dataSource} modelVersion={modelVersion} />
    </div>
  );
}

function recommendationLabel(status: string, index: number, hasEquivalent: boolean): string {
  if (status === 'needs_validation') return 'Perlu dicek';
  if (hasEquivalent) return 'Setara';
  if (index === 0) return 'Pilihan utama';
  return 'Alternatif kuat';
}
