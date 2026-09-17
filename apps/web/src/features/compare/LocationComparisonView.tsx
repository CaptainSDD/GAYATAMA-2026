import { COMPONENT_KEYS, type BusinessType, type ComponentKey, type LatLng } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Card } from '../../components/Card';
import { Attribution, WarningList } from '../../components/Notices';
import { QueryError } from '../../components/QueryState';
import { ScoreSkeleton } from '../../components/Skeleton';
import type { ComparedLocationSide, LocationComparisonResponse, RiskLevel } from '../../lib/api-types';
import {
  BAND_LABELS,
  BUSINESS_TYPE_LABELS,
  COMPONENT_LABELS,
  INDICATOR_LEVEL_LABELS,
  RISK_LEVEL_LABELS,
  ROAD_CLASS_LABELS,
  SATURATION_LABELS,
  SEGMENT_LABELS,
  STATUS_LABELS,
} from '../../lib/copy';
import { displayScore, formatCoordinate, formatDistance, formatWhole } from '../../lib/format';
import { isInSemarangCoverage } from '../../lib/location';
import { useLocationComparison } from '../../lib/queries';

interface LocationComparisonViewProps {
  pointA: LatLng;
  /** `null` until the visitor picks the second point on the map. */
  pointB: LatLng | null;
  businessType: BusinessType;
  onChangeSecondPoint: () => void;
  onExit: () => void;
}

/**
 * Two candidate sites for one chosen category, read as rows: the label, then A,
 * then B. A narrow panel cannot hold two full report columns, but it can hold
 * one indicator per line with both values beside each other, which is what makes
 * a difference visible at all.
 */
export function LocationComparisonView({
  pointA,
  pointB,
  businessType,
  onChangeSecondPoint,
  onExit,
}: LocationComparisonViewProps) {
  const inCoverage = pointB === null || isInSemarangCoverage(pointB);
  const query = useLocationComparison(pointA, inCoverage ? pointB : null, businessType);
  const awaitingSecondPoint = pointB === null;

  return (
    <section className="site-compare" aria-labelledby="site-compare-title">
      <div>
        <span className="eyebrow">Perbandingan lokasi</span>
        <h2 id="site-compare-title">{BUSINESS_TYPE_LABELS[businessType]}</h2>
      </div>

      {awaitingSecondPoint ? (
        <p className="notice notice-neutral" role="status">
          Klik satu titik lagi di peta untuk menentukan <strong>Lokasi B</strong>. Keduanya akan dinilai dengan jenis
          usaha dan kriteria yang sama.
        </p>
      ) : !inCoverage ? (
        <p className="notice" role="status">
          Lokasi B berada di luar area cakupan Semarang. Pilih titik di dalam garis merah pada peta.
        </p>
      ) : (
        <ComparisonBody query={query} />
      )}

      <div className="site-compare-actions">
        {!awaitingSecondPoint && (
          <button type="button" className="button-secondary" onClick={onChangeSecondPoint}>
            Ganti Lokasi B
          </button>
        )}
        <span className="muted">Lokasi A: {formatCoordinate(pointA)}</span>
        <button type="button" className="button-link" onClick={onExit}>
          Selesai membandingkan
        </button>
      </div>
    </section>
  );
}

function ComparisonBody({ query }: { query: UseQueryResult<LocationComparisonResponse> }) {
  if (query.isPending) return <ScoreSkeleton />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const { locations, verdict, modelVersion } = query.data;
  const { a, b } = locations;

  return (
    <>
      <p className="lead">{verdict.summary}</p>
      <p className="notice notice-neutral">{verdict.alternative}</p>

      <div className="site-compare-heads">
        <SideHead side={a} recommended={verdict.winner === 'a'} tied={verdict.tied} />
        <SideHead side={b} recommended={verdict.winner === 'b'} tied={verdict.tied} />
      </div>

      <WarningList warnings={a.warnings} />
      <WarningList warnings={b.warnings} />

      <Card title="Ringkasan" note="A vs B">
        <ComparisonTable>
          <Row
            label="Skor lokasi"
            a={displayScore(a.score.value)}
            b={displayScore(b.score.value)}
            better={compare(a.score.value, b.score.value)}
          />
          <Row label="Kategori kecocokan" a={BAND_LABELS[a.score.band]} b={BAND_LABELS[b.score.band]} />
          <Row label="Status" a={STATUS_LABELS[a.status]} b={STATUS_LABELS[b.status]} />
          <Row
            label="Target pelanggan"
            a={SEGMENT_LABELS[a.targetMarket.segment]}
            b={SEGMENT_LABELS[b.targetMarket.segment]}
          />
          <Row
            label="Kecocokan pelanggan"
            a={INDICATOR_LEVEL_LABELS[a.targetMarket.level]}
            b={INDICATOR_LEVEL_LABELS[b.targetMarket.level]}
            better={compare(levelRank(a.targetMarket.level), levelRank(b.targetMarket.level))}
          />
          <Row
            label="Peluang"
            a={INDICATOR_LEVEL_LABELS[a.opportunityLevel]}
            b={INDICATOR_LEVEL_LABELS[b.opportunityLevel]}
            better={compare(levelRank(a.opportunityLevel), levelRank(b.opportunityLevel))}
          />
          <Row
            label="Lalu lintas harian"
            a={INDICATOR_LEVEL_LABELS[a.trafficLevel]}
            b={INDICATOR_LEVEL_LABELS[b.trafficLevel]}
            better={compare(levelRank(a.trafficLevel), levelRank(b.trafficLevel))}
          />
          <Row
            label="Risiko"
            a={RISK_LEVEL_LABELS[a.riskLevel]}
            b={RISK_LEVEL_LABELS[b.riskLevel]}
            better={compareRisk(a.riskLevel, b.riskLevel)}
          />
        </ComparisonTable>
      </Card>

      <Card title="Rincian penilaian" note="skor 0–100">
        <ComparisonTable>
          {COMPONENT_KEYS.map((key) => (
            <Row
              key={key}
              label={COMPONENT_LABELS[key]}
              a={formatWhole(a.components[key].value)}
              b={formatWhole(b.components[key].value)}
              better={compare(a.components[key].value, b.components[key].value)}
            />
          ))}
        </ComparisonTable>

        <details className="calculation-details">
          <summary>Apa yang membuat selisihnya</summary>
          <div className="disclosure-content">
            <p>
              Kedua lokasi dinilai dengan bobot yang sama, jadi selisih skornya bisa dibagi per faktor. Angka di bawah
              adalah selisih setelah dikali bobot, dan totalnya sama dengan selisih skor.
            </p>
            <ul>
              {verdict.decidingFactors.map((factor) => (
                <li key={factor.component}>
                  <span>{COMPONENT_LABELS[factor.component]}</span>
                  <span>
                    {factor.favours === null
                      ? 'seimbang'
                      : `${factor.weightedDelta > 0 ? '+' : ''}${factor.weightedDelta.toFixed(1)} untuk ${factor.favours.toUpperCase()}`}
                    {!factor.comparable && ' · belum bisa dibandingkan'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="contribution-total">
              <span>Selisih skor</span>
              <strong>{verdict.difference.toFixed(1)}</strong>
            </p>
            {verdict.tied && (
              <p className="muted">
                Selisih di bawah {verdict.equivalenceGap} poin dianggap setara, karena modelnya tidak seteliti itu.
              </p>
            )}
          </div>
        </details>
      </Card>

      <Card title="Persaingan & akses">
        <ComparisonTable>
          <Row
            label="Usaha sejenis"
            a={`${a.competition.rawCount.toLocaleString('id-ID')} dalam ${formatDistance(a.competition.radiusMeters)}`}
            b={`${b.competition.rawCount.toLocaleString('id-ID')} dalam ${formatDistance(b.competition.radiusMeters)}`}
          />
          <Row
            label="Tingkat kejenuhan"
            a={SATURATION_LABELS[a.competition.reading]}
            b={SATURATION_LABELS[b.competition.reading]}
            better={compare(a.components.competition.value, b.components.competition.value)}
          />
          <Row
            label="Setara kompetitor"
            a={a.competition.equivalentCount.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
            b={b.competition.equivalentCount.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
          />
          <Row
            label="Jalan terdekat"
            a={a.mainRoad === null ? 'Belum diketahui' : ROAD_CLASS_LABELS[a.mainRoad]}
            b={b.mainRoad === null ? 'Belum diketahui' : ROAD_CLASS_LABELS[b.mainRoad]}
          />
          <Row
            label="Transportasi umum"
            a={formatWhole(a.accessibility.transit)}
            b={formatWhole(b.accessibility.transit)}
            better={compare(a.accessibility.transit, b.accessibility.transit)}
          />
          <Row
            label="Jalan kaki"
            a={formatWhole(a.accessibility.walkability)}
            b={formatWhole(b.accessibility.walkability)}
            better={compare(a.accessibility.walkability, b.accessibility.walkability)}
          />
          <Row
            label="Parkir"
            a={formatWhole(a.accessibility.parking)}
            b={formatWhole(b.accessibility.parking)}
            better={compare(a.accessibility.parking, b.accessibility.parking)}
          />
        </ComparisonTable>
      </Card>

      <Card title="Landmark sekitar" note="radius 1,5 km">
        <ComparisonTable>
          {a.landmarks.map((landmark, index) => {
            const other = b.landmarks[index];
            return (
              <Row
                key={landmark.id}
                label={landmark.label}
                a={landmarkValue(landmark.count, landmark.nearestMeters)}
                b={landmarkValue(other?.count ?? 0, other?.nearestMeters ?? null)}
                better={compare(landmark.count, other?.count ?? 0)}
              />
            );
          })}
        </ComparisonTable>
      </Card>

      <SideDetail side={a} />
      <SideDetail side={b} />

      <p className="disclaimer">
        Perbandingan memakai data peta di sekitar kedua titik. Biaya sewa, ukuran tempat, dan perizinan tidak ikut
        dinilai, jadi periksa hal itu sebelum memutuskan.
      </p>
      <Attribution dataSource={a.dataSource} modelVersion={modelVersion} />
    </>
  );
}

function SideHead({
  side,
  recommended,
  tied,
}: {
  side: ComparedLocationSide;
  recommended: boolean;
  tied: boolean;
}) {
  return (
    <div className="site-compare-head" data-recommended={recommended}>
      <span className="eyebrow">Lokasi {side.label}</span>
      <span className="site-compare-score">{displayScore(side.score.value)}</span>
      <span className="site-compare-band">{BAND_LABELS[side.score.band]}</span>
      <small className="muted">{formatCoordinate(side.location)}</small>
      {recommended && <small className="site-compare-flag">Lebih disarankan</small>}
      {tied && side.label === 'A' && <small className="site-compare-flag">Setara dengan B</small>}
    </div>
  );
}

function SideDetail({ side }: { side: ComparedLocationSide }) {
  return (
    <details className="card panel-disclosure site-compare-disclosure">
      <summary>Kekuatan & kelemahan Lokasi {side.label}</summary>
      <div className="disclosure-content">
        <p>{side.reason}.</p>
        <FactorList title="Kekuatan" factors={side.strengths} empty="Tidak ada faktor yang mencapai 60." />
        <FactorList title="Kelemahan" factors={side.weaknesses} empty="Tidak ada faktor di bawah 60." />
        <p className="muted">
          Dasar penilaian: {side.evidence.facilityCount.toLocaleString('id-ID')} fasilitas dalam radius 1,5 km.
          {!side.accessibility.siteInputsAvailable &&
            ' Data jalan dan kemudahan jalan kaki gagal dimuat, jadi bagian itu memakai nilai netral 50.'}
        </p>
      </div>
    </details>
  );
}

function FactorList({
  title,
  factors,
  empty,
}: {
  title: string;
  factors: readonly { component: ComponentKey; value: number }[];
  empty: string;
}) {
  return (
    <>
      <h4 className="site-compare-subhead">{title}</h4>
      {factors.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="site-compare-factors">
          {factors.map((factor) => (
            <li key={factor.component}>
              <span>{COMPONENT_LABELS[factor.component]}</span>
              <span>{formatWhole(factor.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ComparisonTable({ children }: { children: ReactNode }) {
  return (
    <dl className="site-compare-table">
      <div className="site-compare-legend" aria-hidden="true">
        <span />
        <span>A</span>
        <span>B</span>
      </div>
      {children}
    </dl>
  );
}

function Row({
  label,
  a,
  b,
  better,
}: {
  label: string;
  a: string;
  b: string;
  /** Marks the stronger side. Left out for rows where neither value is "better". */
  better?: 'a' | 'b' | null;
}) {
  return (
    <div className="site-compare-row">
      <dt>{label}</dt>
      <dd data-better={better === 'a'}>
        {a}
        {better === 'a' && <span className="visually-hidden"> (lebih baik)</span>}
      </dd>
      <dd data-better={better === 'b'}>
        {b}
        {better === 'b' && <span className="visually-hidden"> (lebih baik)</span>}
      </dd>
    </div>
  );
}

function landmarkValue(count: number, nearestMeters: number | null): string {
  if (count === 0) return 'Tidak ada';
  const nearest = nearestMeters === null ? '' : ` · ${formatDistance(nearestMeters)}`;
  return `${count.toLocaleString('id-ID')}${nearest}`;
}

/** Higher is better on every scale passed here. */
function compare(a: number, b: number): 'a' | 'b' | null {
  if (a === b) return null;
  return a > b ? 'a' : 'b';
}

function levelRank(level: 'high' | 'moderate' | 'low'): number {
  return level === 'high' ? 3 : level === 'moderate' ? 2 : 1;
}

/** Less risk is better, and an unrated side cannot win the row. */
function compareRisk(a: RiskLevel, b: RiskLevel): 'a' | 'b' | null {
  if (a === 'unknown' || b === 'unknown' || a === b) return null;
  const rank = (level: Exclude<RiskLevel, 'unknown'>) => (level === 'low' ? 3 : level === 'moderate' ? 2 : 1);
  return rank(a) > rank(b) ? 'a' : 'b';
}
