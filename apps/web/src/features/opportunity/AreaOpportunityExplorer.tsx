import type { BusinessType, LatLng } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { Loading, QueryError } from '../../components/QueryState';
import type { OpportunitiesResponse } from '../../lib/api-types';
import { scoreTone, toneColor, toneTextColor, type Tone } from '../../lib/band-color';
import { BUSINESS_TYPE_LABELS } from '../../lib/copy';
import { displayScore } from '../../lib/format';
import { KecamatanDetail } from './KecamatanDetail';
import { bestCell, isScored, type Cell } from './grid';

/** Low to high, for the legend — the same tones every tile's score is coloured with. */
const LEGEND_TONES: readonly Tone[] = ['bad', 'poor', 'fair', 'good', 'excellent'];

interface AreaOpportunityExplorerProps {
  query: UseQueryResult<OpportunitiesResponse>;
  businessType: BusinessType;
  /**
   * Demo-only client toggle, not a real entitlement check — see
   * `apps/web/src/App.tsx`. Freemium clicks a kecamatan straight into its
   * representative point's full analysis; premium clicks into a shortlist of
   * candidates inside that kecamatan first.
   */
  isPremium: boolean;
  /** Opens the full analysis at a clicked point. */
  onSelectPoint: (point: LatLng) => void;
  /** Back to picking a point directly, for a visitor who already knows where. */
  onExit: () => void;
}

export function AreaOpportunityExplorer({ query, businessType, isPremium, onSelectPoint, onExit }: AreaOpportunityExplorerProps) {
  const [selectedKecamatan, setSelectedKecamatan] = useState<{ id: string; label: string; lat: number; lng: number } | null>(
    null,
  );

  const exitLink = (
    <button type="button" className="button-secondary" onClick={onExit}>
      Sudah tahu lokasinya? Pilih titik sendiri di peta
    </button>
  );

  if (selectedKecamatan !== null) {
    return (
      <KecamatanDetail
        kecamatanId={selectedKecamatan.id}
        label={selectedKecamatan.label}
        point={{ lat: selectedKecamatan.lat, lng: selectedKecamatan.lng }}
        businessType={businessType}
        onSelectPoint={onSelectPoint}
        onBack={() => setSelectedKecamatan(null)}
      />
    );
  }

  if (query.isPending) return <Loading message="Menilai satu titik wakil di tiap kecamatan…" />;
  if (query.isError)
    return (
      <>
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
        {exitLink}
      </>
    );

  const { cells } = query.data;
  // Best first, so the list reads the same order the eye scans the map's brightest pin —
  // but every kecamatan that returned a result is shown, not a curated top few.
  const ordered = [...cells].sort((a, b) => {
    const aScore = isScored(a) ? a.score : -Infinity;
    const bScore = isScored(b) ? b.score : -Infinity;
    return bScore - aScore;
  });
  const best = bestCell(cells);

  return (
    <div className="opportunity">
      <p className="lead">
        Belum tahu mau mulai di mana? LOKABIS menilai satu titik wakil di tiap kecamatan Semarang untuk{' '}
        {BUSINESS_TYPE_LABELS[businessType]} — hijau berarti berpotensi tinggi, merah berarti rendah.{' '}
        {isPremium
          ? 'Klik kecamatan mana pun untuk melihat rincian skornya dan titik-titik terbaik di dalamnya.'
          : 'Skor tiap kecamatan dihitung dari total fasilitas & pesaing di sekitar titik wakilnya. Rincian dan titik terbaik di dalamnya ada di paket premium.'}
      </p>

      {isPremium && (
        <p className="notice notice-neutral" role="status">
          Mode premium (demo) aktif — tidak ada pembayaran sungguhan, hanya untuk menunjukkan konsepnya.
        </p>
      )}

      <OpportunityLegend />

      <ul className="opportunity-point-list">
        {ordered.map((cell) => (
          <OpportunityRow
            key={cell.id}
            cell={cell}
            isBest={best !== null && cell.id === best.id}
            isPremium={isPremium}
            onSelect={
              isPremium ? () => setSelectedKecamatan({ id: cell.id, label: cell.label, lat: cell.lat, lng: cell.lng }) : undefined
            }
          />
        ))}
      </ul>

      {cells.some((cell) => cell.status !== 'scored') && (
        <p className="muted">
          Kecamatan tanpa angka berarti data peta di sana terlalu tipis untuk dinilai, atau gagal dimuat. Kecamatan
          itu tidak otomatis buruk — hanya belum bisa dibandingkan.
        </p>
      )}

      <p className="muted">
        Setiap kecamatan diwakili satu titik tetap, bukan hasil pencarian titik terbaik di kecamatan itu — anggap ini
        titik awal, bukan jawaban akhir. Fitur ini hanya memakai data OpenStreetMap; jumlah usaha dari Google tidak
        bisa dibagi jujur ke titik-titik terpisah seperti ini.
      </p>

      {exitLink}
    </div>
  );
}

function OpportunityLegend() {
  return (
    <div className="opportunity-legend" aria-hidden="true">
      <span className="opportunity-legend-label">Rendah</span>
      <span className="opportunity-legend-scale">
        {LEGEND_TONES.map((tone) => (
          <span key={tone} className="opportunity-legend-swatch" style={{ background: toneColor(tone) }} />
        ))}
      </span>
      <span className="opportunity-legend-label">Tinggi</span>
    </div>
  );
}

function OpportunityRow({
  cell,
  isBest,
  isPremium,
  onSelect,
}: {
  cell: Cell;
  isBest: boolean;
  isPremium: boolean;
  onSelect?: () => void;
}) {
  const classes = ['opportunity-point-row'];
  if (isBest) classes.push('opportunity-point-row-best');

  if (cell.status !== 'scored' || cell.score === null) {
    return (
      <li className={`${classes.join(' ')} opportunity-point-row-blank`}>
        <span className="opportunity-point-label">{cell.label}</span>
        <span className="opportunity-point-score muted">{cell.status === 'unavailable' ? 'gagal' : 'data tipis'}</span>
      </li>
    );
  }

  const rowContent = (
    <>
      <span
        className="opportunity-point-dot"
        aria-hidden="true"
        style={{ background: toneColor(scoreTone(cell.score)) }}
      />
      <span className="opportunity-point-label">{cell.label}</span>
      <span className="opportunity-point-score" style={{ color: toneTextColor(scoreTone(cell.score)) }}>
        {displayScore(cell.score)}
      </span>
      {isPremium && cell.confidence !== null && (
        <span className="opportunity-point-confidence muted">yakin {Math.round(cell.confidence)}</span>
      )}
    </>
  );

  // Free tier sees the score only: no confidence figure (handled above) and
  // no way in to the "why" behind it, so the row is not interactive.
  if (!isPremium || onSelect === undefined) {
    return <li className={`${classes.join(' ')} opportunity-point-row-locked`}>{rowContent}</li>;
  }

  const label = `${cell.label}, skor ${displayScore(cell.score)}. Lihat rincian`;
  return (
    <li className={classes.join(' ')}>
      <button type="button" className="opportunity-point-button" onClick={onSelect} aria-label={label}>
        {rowContent}
      </button>
    </li>
  );
}
