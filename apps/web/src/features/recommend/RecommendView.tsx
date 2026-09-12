import { BUSINESS_TYPES, type BusinessType } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { Card } from '../../components/Card';
import { CompassIcon } from '../../components/Icons';
import { Attribution, DataNotices, WarningList } from '../../components/Notices';
import { QueryError } from '../../components/QueryState';
import { ScoreInline } from '../../components/ScoreInline';
import { ScoreSkeleton } from '../../components/Skeleton';
import type { RecommendResponse } from '../../lib/api-types';
import { bandTone, toneChip, toneColor } from '../../lib/band-color';
import { BUSINESS_TYPE_LABELS, SEGMENT_LABELS, STATUS_LABELS } from '../../lib/copy';

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
      <p className="lead">
        Ketujuh jenis usaha, dinilai untuk lokasi ini. Maksimal tiga yang bernilai 60 ke atas ditampilkan sebagai
        rekomendasi. Jenis usaha yang selisihnya 3 poin atau kurang dianggap sama-sama cocok, bukan diurutkan.
      </p>

      <DataNotices dataSource={dataSource} onRefresh={() => void query.refetch()} refreshing={query.isFetching} />
      <WarningList warnings={warnings} />

      {needsValidation && (
        <p className="notice">
          Data di sekitar lokasi ini belum lengkap, jadi belum ada yang bisa direkomendasikan dengan yakin. Anggap
          daftar ini sebagai petunjuk awal yang masih perlu dicek langsung di lapangan.
        </p>
      )}

      {recommendations.length === 0 ? (
        <p className="notice">Tidak ada jenis usaha yang mencapai nilai 60 di lokasi ini.</p>
      ) : (
        <ol className="recommendation-list">
          {recommendations.map((entry, index) => {
            const peers = peersOf(entry.businessType);
            const tone = bandTone(entry.score.band);
            return (
              <li
                key={entry.businessType}
                className="recommendation"
                style={{ ['--accent' as string]: toneColor(tone) }}
              >
                <div className="recommendation-head">
                  <h3>
                    <span className="recommendation-rank" aria-hidden="true">
                      {index + 1}
                    </span>
                    {BUSINESS_TYPE_LABELS[entry.businessType]}
                  </h3>
                  <ScoreInline score={entry.score} />
                </div>
                <p>
                  <span className={toneChip(tone)}>{STATUS_LABELS[entry.status]}</span>
                </p>
                <p>{entry.rationale}.</p>
                <p className="muted">
                  Pelanggan utama: {SEGMENT_LABELS[entry.dominantSegment]}. {entry.differentiator}.
                </p>
                {peers.length > 0 && (
                  <p className="equivalence">
                    <CompassIcon size={16} />
                    <span>
                      Selisihnya 3 poin atau kurang dengan{' '}
                      {peers.map((peer) => BUSINESS_TYPE_LABELS[peer]).join(' dan ')} — perlakukan sebagai sama-sama
                      cocok, bukan lebih unggul.
                    </span>
                  </p>
                )}
                <button type="button" className="button-link" onClick={() => onAnalyse(entry.businessType)}>
                  Lihat analisis lengkapnya
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {unlisted > 0 && (
        <p className="muted">
          {unlisted === 1
            ? '1 jenis usaha lain juga bernilai 60 ke atas, tapi berada di bawah tiga besar.'
            : `${unlisted} jenis usaha lain juga bernilai 60 ke atas, tapi berada di bawah tiga besar.`}
        </p>
      )}

      {notRecommended.length > 0 && (
        <Card title="Tidak direkomendasikan di sini">
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
        </Card>
      )}

      <Attribution dataSource={dataSource} modelVersion={modelVersion} />
    </div>
  );
}
