import { SEGMENT_WEIGHTS, SEGMENTS, type LatLng } from '@gayatama/scoring';
import { Attribution, StaleDataNotice } from '../../components/Notices';
import type { AnalysisResponse } from '../../lib/api-types';
import { BUSINESS_TYPE_LABELS, FACILITY_KIND_LABELS, SEGMENT_LABELS } from '../../lib/copy';
import { segmentEvidence, type KindCount } from '../../lib/evidence';
import { formatPercent } from '../../lib/format';
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
  const ordered = [...SEGMENTS]
    .filter((segment) => weights[segment] > 0)
    .sort((a, b) => weights[b] * analysis.segments[b].score - weights[a] * analysis.segments[a].score);

  return (
    <div className="segments">
      <p className="lead">Indikator fasilitas di sekitar lokasi—bukan jumlah penduduk atau perkiraan omzet.</p>

      {analysis.dataSource.stale && <StaleDataNotice fetchedAt={analysis.dataSource.fetchedAt} />}

      <ol className="segment-list">
        {ordered.map((segment, index) => {
          const { score } = analysis.segments[segment];
          const weight = weights[segment];
          const signal = segmentSignal(score);
          return (
            <li key={segment} className="segment">
              <div className="component-head segment-head">
                <div>
                  <span className="segment-position">{index === 0 ? 'Paling relevan' : `Urutan ${index + 1}`}</span>
                  <h3>{SEGMENT_LABELS[segment]}</h3>
                </div>
                <span className="segment-signal">{signal}</span>
              </div>
              <details className="panel-disclosure segment-details">
                <summary>Lihat indikator</summary>
                <div className="disclosure-content">
                  <p>{segmentExplanation(segment)}</p>
                  <Evidence kinds={evidence?.[segment]} failed={pois.isError} />
                  <p className="muted">
                    Bobot {formatPercent(weight)} untuk {businessLabel}; dihitung dari fasilitas, jarak, dan kualitas
                    data.
                  </p>
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <Attribution dataSource={analysis.dataSource} />
    </div>
  );
}

function Evidence({ kinds, failed }: { kinds: KindCount[] | undefined; failed: boolean }) {
  if (failed) return <p className="component-description">Detail fasilitas gagal dimuat.</p>;
  if (kinds === undefined) return <p className="component-description">Memuat detail fasilitas…</p>;
  if (kinds.length === 0) return <p className="component-description">Belum ada fasilitas pendukung yang terpetakan.</p>;
  return (
    <ul className="evidence-chips">
      {kinds.map(({ kind, count }) => (
        <li key={kind} className="evidence-chip">
          <b>{count.toLocaleString('id-ID')}</b> {FACILITY_KIND_LABELS[kind].toLowerCase()}
        </li>
      ))}
    </ul>
  );
}

function segmentSignal(score: number): string {
  if (score >= 80) return 'Sangat kuat';
  if (score >= 60) return 'Kuat';
  if (score >= 40) return 'Sedang';
  return 'Terbatas';
}

function segmentExplanation(segment: (typeof SEGMENTS)[number]): string {
  switch (segment) {
    case 'student':
      return 'Ditandai oleh sekolah, kampus, dan tempat tinggal pelajar di sekitar lokasi.';
    case 'office':
      return 'Ditandai oleh kantor, instansi, kampus, rumah sakit, dan pusat kegiatan komersial.';
    case 'resident':
      return 'Ditandai oleh permukiman, kos atau asrama, serta sekolah di lingkungan sekitar.';
    case 'commuter':
      return 'Ditandai oleh halte, stasiun, dan pusat kegiatan yang mendatangkan orang dari area lain.';
    case 'health':
      return 'Ditandai oleh rumah sakit dan fasilitas kesehatan di sekitar lokasi.';
    case 'general':
      return 'Ditandai oleh pusat kegiatan yang menarik pengunjung umum.';
  }
}
