import type { BusinessType } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { CompassIcon } from '../../components/Icons';
import { Attribution, WarningList } from '../../components/Notices';
import { QueryError } from '../../components/QueryState';
import { ScoreInline } from '../../components/ScoreInline';
import { ScoreSkeleton } from '../../components/Skeleton';
import type { ComparedCategory, ComparisonResponse } from '../../lib/api-types';
import {
  BUSINESS_TYPE_EXAMPLES,
  BUSINESS_TYPE_LABELS,
  INDICATOR_LEVEL_LABELS,
  RISK_LEVEL_LABELS,
  SATURATION_LABELS,
  SEGMENT_LABELS,
  STATUS_LABELS,
} from '../../lib/copy';
import { formatDistance, formatWhole } from '../../lib/format';

interface ComparisonViewProps {
  query: UseQueryResult<ComparisonResponse>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalyse: (businessType: BusinessType) => void;
}

/**
 * The location-first route: instead of scoring one chosen category, this ranks
 * every category for the point so the visitor can pick one. It sits in a
 * disclosure beside the ranking so the existing flow is unchanged until opened.
 */
export function ComparisonView({ query, open, onOpenChange, onAnalyse }: ComparisonViewProps) {
  return (
    <details
      className="card panel-disclosure comparison-disclosure"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary>Belum tahu mau usaha apa?</summary>
      <div className="disclosure-content">
        <ComparisonBody query={query} onAnalyse={onAnalyse} />
      </div>
    </details>
  );
}

function ComparisonBody({ query, onAnalyse }: Pick<ComparisonViewProps, 'query' | 'onAnalyse'>) {
  if (query.isPending) return <ScoreSkeleton />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const { categories, equivalent, highlight, shared, warnings, dataSource, modelVersion } = query.data;
  const peersOf = (type: BusinessType) =>
    (equivalent.find((group) => group.includes(type)) ?? []).filter((other) => other !== type);

  return (
    <>
      <p className="lead">{highlight}</p>
      <WarningList warnings={warnings} />

      <ol className="recommendation-list">
        {categories.map((entry) => (
          <li key={entry.businessType} className="recommendation">
            <div className="recommendation-head">
              <h3>
                <span className="recommendation-rank" aria-hidden="true">{entry.rank}</span>
                {BUSINESS_TYPE_LABELS[entry.businessType]}
              </h3>
              <ScoreInline score={entry.score} />
            </div>
            <p className="recommendation-status">{STATUS_LABELS[entry.status]}</p>
            <p className="muted">{BUSINESS_TYPE_EXAMPLES[entry.businessType]}</p>

            <dl className="stats">
              <div>
                <dt>Target pelanggan</dt>
                <dd>{SEGMENT_LABELS[entry.targetMarket.segment]}</dd>
                <small>kecocokan {INDICATOR_LEVEL_LABELS[entry.targetMarket.level].toLowerCase()}</small>
              </div>
              <div>
                <dt>Persaingan</dt>
                <dd>{SATURATION_LABELS[entry.competition.reading]}</dd>
                <small>
                  {entry.competition.rawCount.toLocaleString('id-ID')} usaha sejenis dalam{' '}
                  {formatDistance(entry.competition.radiusMeters)}
                </small>
              </div>
              <div>
                <dt>Peluang</dt>
                <dd>{INDICATOR_LEVEL_LABELS[entry.opportunityLevel]}</dd>
                <small>gabungan skor lokasi dan ruang persaingan</small>
              </div>
              <div>
                <dt>Risiko</dt>
                <dd>{RISK_LEVEL_LABELS[entry.riskLevel]}</dd>
                <small>
                  {entry.riskLevel === 'unknown'
                    ? 'data kondisi lokasi gagal dimuat'
                    : 'dari kondisi lingkungan pada data peta'}
                </small>
              </div>
              <div>
                <dt>Fasilitas pendukung</dt>
                <dd>{INDICATOR_LEVEL_LABELS[entry.supportingFacility.level]}</dd>
                <small>skor {formatWhole(entry.supportingFacility.value)}</small>
              </div>
              <div>
                <dt>Lalu lintas harian</dt>
                <dd>{INDICATOR_LEVEL_LABELS[entry.trafficLevel]}</dd>
                <small>perkiraan dari data peta</small>
              </div>
            </dl>

            <p className="recommendation-rationale">{entry.reason}.</p>

            <details className="panel-disclosure recommendation-details">
              <summary>Detail perbandingan</summary>
              <div className="disclosure-content">
                <p>{entry.differentiator}</p>
                <p className="muted">
                  Setara {entry.competition.equivalentCount.toLocaleString('id-ID', { maximumFractionDigits: 2 })}{' '}
                  kompetitor setelah jarak, kualitas data, jam buka, kemiripan, dan skala diperhitungkan.
                </p>
                <ComponentBreakdown entry={entry} />
                {peersOf(entry.businessType).length > 0 && (
                  <p className="equivalence">
                    <CompassIcon size={16} />
                    <span>
                      Skornya berdekatan dengan{' '}
                      {peersOf(entry.businessType).map((peer) => BUSINESS_TYPE_LABELS[peer]).join(' dan ')}.
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
        ))}
      </ol>

      <details className="panel-disclosure">
        <summary>Yang sama untuk semua jenis usaha</summary>
        <div className="disclosure-content">
          <p>
            Kemudahan akses dan keamanan operasional dinilai dari titiknya, bukan dari jenis usaha, jadi nilainya sama
            di seluruh daftar. Kemudahan akses{' '}
            {INDICATOR_LEVEL_LABELS[shared.accessibility.level].toLowerCase()} (skor{' '}
            {formatWhole(shared.accessibility.value)}).
          </p>
          {!shared.accessibility.siteInputsAvailable && (
            <p className="muted">
              Data jalan dan kemudahan jalan kaki gagal dimuat, jadi bagian itu memakai nilai netral 50.
            </p>
          )}
          <p className="muted">
            Dasar penilaian: {shared.evidence.facilityCount.toLocaleString('id-ID')} fasilitas dalam radius 1,5 km.
          </p>
        </div>
      </details>

      <p className="disclaimer">
        Perbandingan ini membantu mempersempit pilihan, bukan menjamin keuntungan. Cek modal, sewa, perizinan, dan
        kondisi lapangan sebelum memutuskan.
      </p>
      <Attribution dataSource={dataSource} modelVersion={modelVersion} />
    </>
  );
}

/** The three components that differ between categories at the same location. */
function ComponentBreakdown({ entry }: { entry: ComparedCategory }) {
  return (
    <p className="muted">
      Potensi pelanggan {formatWhole(entry.components.demandFit.value)}, kondisi persaingan{' '}
      {formatWhole(entry.components.competition.value)}, fasilitas pendukung{' '}
      {formatWhole(entry.components.supportingFacility.value)} dari 100.
    </p>
  );
}
