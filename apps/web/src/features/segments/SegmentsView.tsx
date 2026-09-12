import { SEGMENT_WEIGHTS, SEGMENTS, type LatLng } from '@gayatama/scoring';
import { Attribution, StaleDataNotice } from '../../components/Notices';
import type { AnalysisResponse } from '../../lib/api-types';
import { roleTone, toneChip, toneColor } from '../../lib/band-color';
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
  const evidence = pois.data === undefined ? null : segmentEvidence(pois.data.facilities, pois.data.facilityCounts);
  const businessLabel = BUSINESS_TYPE_LABELS[analysis.businessType];
  const weights = SEGMENT_WEIGHTS[analysis.businessType];
  const ordered = [...SEGMENTS].sort((a, b) => analysis.segments[b].score - analysis.segments[a].score);

  return (
    <div className="segments">
      {/* Interface rule: these are strength indicators, never population counts. */}
      <p className="lead">
        Seberapa kuat tiap kelompok pelanggan di sekitar lokasi ini, dinilai dari fasilitas yang ditemukan dalam
        radius 1,5 km. Ini indikator kekuatan, <strong>bukan jumlah penduduk</strong>: LOKABIS tidak punya data
        demografi dan tidak memperkirakannya.
      </p>

      {analysis.dataSource.stale && <StaleDataNotice fetchedAt={analysis.dataSource.fetchedAt} />}

      <ul className="segment-list">
        {ordered.map((segment) => {
          const { score, role } = analysis.segments[segment];
          const weight = weights[segment];
          const tone = roleTone(role);
          return (
            <li key={segment} className="segment">
              <div className="component-head">
                <span className="component-label">{SEGMENT_LABELS[segment]}</span>
                <span className="component-value" style={{ color: toneColor(tone) }}>
                  {formatWhole(score)}
                </span>
              </div>
              <div className="bar" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.max(0, Math.min(100, score))}%`,
                    ['--bar-color' as string]: toneColor(tone),
                  }}
                />
              </div>
              <p className="segment-meta">
                <span className={toneChip(tone)}>{SEGMENT_ROLE_LABELS[role]}</span>
                {score >= 100 && <span>dibatasi di 100</span>}
                <span>
                  {weight > 0
                    ? `${formatPercent(weight)} dari Kecocokan Permintaan ${businessLabel}`
                    : `Tidak dihitung dalam Kecocokan Permintaan ${businessLabel}`}
                </span>
              </p>
              <Evidence kinds={evidence?.[segment]} failed={pois.isError} />
            </li>
          );
        })}
      </ul>

      <Attribution dataSource={analysis.dataSource} />
    </div>
  );
}

/** The mapped facilities behind a segment score — the reason to trust the number. */
function Evidence({ kinds, failed }: { kinds: KindCount[] | undefined; failed: boolean }) {
  if (failed) return <p className="component-description">Daftar fasilitas di balik skor ini gagal dimuat.</p>;
  if (kinds === undefined) return <p className="component-description">Memuat fasilitas di balik skor ini…</p>;
  if (kinds.length === 0) {
    return <p className="component-description">Tidak ada fasilitas terpetakan yang menandakan kelompok ini.</p>;
  }
  return (
    <ul className="evidence-chips">
      {kinds.map(({ kind, count }) => (
        <li key={kind} className="evidence-chip">
          {FACILITY_KIND_LABELS[kind]} <b>×{count}</b>
        </li>
      ))}
    </ul>
  );
}
