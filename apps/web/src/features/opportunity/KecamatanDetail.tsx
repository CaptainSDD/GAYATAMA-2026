import type { BusinessType, ComponentWeights, LatLng } from '@gayatama/scoring';
import { useState } from 'react';
import { Loading, QueryError } from '../../components/QueryState';
import { scoreTone, toneColor, toneTextColor } from '../../lib/band-color';
import { displayScore } from '../../lib/format';
import { useAnalysis, useLocationDetails, useOpportunities } from '../../lib/queries';
import { ScorePanel } from '../score/ScorePanel';
import { topScored } from './grid';

/** How many local candidates the stage-2 list surfaces, at most. */
const SHOWN_COUNT = 5;

interface KecamatanDetailProps {
  kecamatanId: string;
  label: string;
  /** The kecamatan's representative point — the same one the coarse score in the list was computed from. */
  point: LatLng;
  businessType: BusinessType;
  /** Opens the full analysis at a chosen candidate. */
  onSelectPoint: (point: LatLng) => void;
  /** Back to the sixteen-kecamatan list. */
  onBack: () => void;
}

export function KecamatanDetail({ kecamatanId, label, point, businessType, onSelectPoint, onBack }: KecamatanDetailProps) {
  const [weights, setWeights] = useState<ComponentWeights | null>(null);
  const analysis = useAnalysis(point, businessType, weights ?? undefined);

  const backLink = (
    <button type="button" className="button-secondary" onClick={onBack}>
      ← Kembali ke daftar kecamatan
    </button>
  );

  return (
    <div className="opportunity">
      <p className="lead kecamatan-detail-intro">
        Skor ini dihitung dua tahap. Pertama, total fasilitas pendukung dan pesaing di sekitar titik wakil{' '}
        <strong>{label}</strong> (radius 1,5 km) — bukan satu-satu grid. Kalau area ini kelihatan potensial, LOKABIS
        lanjut mengecek beberapa titik representatif tambahan di dalamnya (dekat keramaian, jalan besar, dekat
        kampus) — daftarnya ada di bawah.
      </p>

      {analysis.isPending && <Loading message={`Menganalisis titik wakil ${label}…`} />}
      {analysis.isError && <QueryError error={analysis.error} onRetry={() => void analysis.refetch()} />}
      {analysis.isSuccess && (
        <ScorePanel
          analysis={analysis.data}
          onRefresh={() => void analysis.refetch()}
          refreshing={analysis.isFetching}
          weights={weights}
          onWeightsChange={setWeights}
        />
      )}

      <LocalCandidates kecamatanId={kecamatanId} label={label} businessType={businessType} onSelectPoint={onSelectPoint} />

      {backLink}
    </div>
  );
}

/** Stage 2: a handful of representative points inside the kecamatan, scored the same way as the coarse point. */
function LocalCandidates({
  kecamatanId,
  label,
  businessType,
  onSelectPoint,
}: {
  kecamatanId: string;
  label: string;
  businessType: BusinessType;
  onSelectPoint: (point: LatLng) => void;
}) {
  const query = useOpportunities(true, businessType, kecamatanId);

  if (query.isPending) return <Loading message={`Menilai titik-titik lain di ${label}…`} />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const candidates = topScored(query.data.cells, SHOWN_COUNT);

  return (
    <section className="kecamatan-local-candidates">
      <h2>Titik lain yang layak dicek di {label}</h2>
      <p className="muted">
        Lima titik dengan skor tertinggi dari sembilan yang dicoba di sekitar titik wakil. Ini bukan pencarian
        menyeluruh — anggap sebagai titik awal yang lebih spesifik, tetap cek langsung di lapangan sebelum
        memutuskan.
      </p>

      {candidates.length === 0 ? (
        <p className="notice" role="status">
          Tidak ada titik lain di {label} yang datanya cukup untuk dinilai.
        </p>
      ) : (
        <ul className="candidate-list">
          {candidates.map((cell, index) => (
            <CandidateCard
              key={cell.id}
              rank={index + 1}
              point={{ lat: cell.lat, lng: cell.lng }}
              score={cell.score}
              confidence={cell.confidence}
              onSelect={() => onSelectPoint({ lat: cell.lat, lng: cell.lng })}
            />
          ))}
        </ul>
      )}

      {candidates.length < SHOWN_COUNT && candidates.length > 0 && (
        <p className="muted">
          Hanya {candidates.length} dari {SHOWN_COUNT} titik yang datanya cukup untuk dinilai di kecamatan ini.
        </p>
      )}
    </section>
  );
}

/** One candidate: its own reverse-geocode lookup, so five cards don't share one hook. */
function CandidateCard({
  rank,
  point,
  score,
  confidence,
  onSelect,
}: {
  rank: number;
  point: LatLng;
  score: number;
  confidence: number | null;
  onSelect: () => void;
}) {
  const details = useLocationDetails(point);
  const address = details.data?.address?.formatted ?? null;

  return (
    <li className="candidate-card">
      <button type="button" className="candidate-card-button" onClick={onSelect}>
        <span className="candidate-card-rank" aria-hidden="true">
          {rank}
        </span>
        <span className="candidate-card-body">
          <span className="candidate-card-address">
            {details.isPending ? 'Mencari alamat…' : (address ?? 'Alamat belum tersedia')}
          </span>
          {confidence !== null && <span className="candidate-card-confidence muted">yakin {Math.round(confidence)}</span>}
        </span>
        <span className="candidate-card-score" style={{ color: toneTextColor(scoreTone(score)) }}>
          {displayScore(score)}
        </span>
        <span className="candidate-card-dot" aria-hidden="true" style={{ background: toneColor(scoreTone(score)) }} />
      </button>
    </li>
  );
}
