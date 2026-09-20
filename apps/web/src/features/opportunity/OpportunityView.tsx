import type { BusinessType, LatLng } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Loading, QueryError } from '../../components/QueryState';
import type { OpportunitiesResponse } from '../../lib/api-types';
import { scoreTone, toneTextColor } from '../../lib/band-color';
import { BUSINESS_TYPE_LABELS } from '../../lib/copy';
import { displayScore, formatDistance } from '../../lib/format';
import { CENTRE_ID, COLUMNS, DIRECTIONS, ROWS, bestCell, cellDistanceMeters, type Cell, type ScoredCell } from './grid';

interface OpportunityViewProps {
  query: UseQueryResult<OpportunitiesResponse>;
  businessType: BusinessType;
  onAnalysePoint: (point: LatLng) => void;
  /**
   * Marks a point on the map while it is pointed at here. Must be referentially
   * stable — the cleanup below depends on it.
   */
  onHoverPoint: (point: LatLng | null) => void;
}

export function OpportunityView({ query, businessType, onAnalysePoint, onHoverPoint }: OpportunityViewProps) {
  // Declared before the early returns below, because a hook cannot be skipped.
  // Leaving this tab, or picking one of the nine, must not leave a marker
  // pulsing on the map with nothing on screen explaining it.
  useEffect(() => () => onHoverPoint(null), [onHoverPoint]);

  if (query.isPending) return <Loading message="Menilai sembilan titik di sekitar sini…" />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const { cells, spacingMeters } = query.data;
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const centre = byId.get(CENTRE_ID);
  const best = bestCell(cells);

  return (
    <div className="opportunity">
      <p className="lead">
        Sembilan titik berjarak {formatDistance(spacingMeters)}, dinilai untuk {BUSINESS_TYPE_LABELS[businessType]}.
        Pertanyaannya bukan "apakah titik ini bagus", tapi "apakah ada sudut yang lebih baik di sekitarnya".
      </p>

      <div className="opportunity-grid" role="group" aria-label="Peta peluang sembilan titik">
        {ROWS.map((row) =>
          COLUMNS.map((column) => {
            const cell = byId.get(`${row}:${column}`);
            if (cell === undefined) return null;
            return (
              <OpportunityCell
                key={cell.id}
                cell={cell}
                isCentre={cell.id === CENTRE_ID}
                isBest={best !== null && cell.id === best.id && best.id !== CENTRE_ID}
                onAnalyse={() => onAnalysePoint({ lat: cell.lat, lng: cell.lng })}
                onHover={(hovering) => onHoverPoint(hovering ? { lat: cell.lat, lng: cell.lng } : null)}
              />
            );
          }),
        )}
      </div>
      <p className="opportunity-compass muted" aria-hidden="true">
        Atas = utara
      </p>

      <Verdict
        centre={centre}
        best={best}
        spacingMeters={spacingMeters}
        onAnalysePoint={onAnalysePoint}
        onHoverPoint={onHoverPoint}
      />

      {cells.some((cell) => cell.status !== 'scored') && (
        <p className="muted">
          Kotak tanpa angka berarti data peta di sana terlalu tipis untuk dinilai, atau gagal dimuat. Titik itu tidak
          otomatis buruk — hanya belum bisa dibandingkan.
        </p>
      )}

      <p className="muted">
        Semua titik di sini dinilai dari OpenStreetMap saja. Hitungan usaha dari Google tidak dipakai, karena satu angka
        wilayah tidak bisa dibagi jujur ke sembilan titik terpisah.
      </p>
    </div>
  );
}

function OpportunityCell({
  cell,
  isCentre,
  isBest,
  onAnalyse,
  onHover,
}: {
  cell: Cell;
  isCentre: boolean;
  isBest: boolean;
  onAnalyse: () => void;
  onHover: (hovering: boolean) => void;
}) {
  const direction = DIRECTIONS[cell.id] ?? '';
  const classes = ['opportunity-cell'];
  if (isCentre) classes.push('opportunity-cell-centre');
  if (isBest) classes.push('opportunity-cell-best');

  /**
   * Focus as well as hover, so tabbing through the eight marks the map the same
   * way pointing at them does. The centre cell is left out: it is the analysed
   * point, and it already carries the pin.
   */
  const pointerProps = isCentre
    ? {}
    : {
        onMouseEnter: () => onHover(true),
        onMouseLeave: () => onHover(false),
        onFocus: () => onHover(true),
        onBlur: () => onHover(false),
      };

  if (cell.status !== 'scored' || cell.score === null) {
    // Still marked on hover: "where is the point I could not score" is a fair
    // question, and the answer is the same kind of answer.
    return (
      <div className={`${classes.join(' ')} opportunity-cell-blank`} {...pointerProps}>
        <span className="opportunity-direction">{isCentre ? 'Titik Anda' : direction}</span>
        <span className="opportunity-score muted">{cell.status === 'unavailable' ? 'gagal' : 'data tipis'}</span>
      </div>
    );
  }

  const label = `${isCentre ? 'Titik Anda' : `Titik ${direction}`}, skor ${displayScore(cell.score)}`;
  const body = (
    <>
      <span className="opportunity-direction">{isCentre ? 'Titik Anda' : direction}</span>
      <span className="opportunity-score" style={{ color: toneTextColor(scoreTone(cell.score)) }}>
        {displayScore(cell.score)}
      </span>
      {cell.confidence !== null && <span className="opportunity-confidence muted">yakin {Math.round(cell.confidence)}</span>}
    </>
  );

  if (isCentre) {
    return (
      <div className={classes.join(' ')} aria-label={label}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={onAnalyse}
      aria-label={`${label}. Analisis titik ini`}
      {...pointerProps}
    >
      {body}
    </button>
  );
}

function Verdict({
  centre,
  best,
  spacingMeters,
  onAnalysePoint,
  onHoverPoint,
}: {
  centre: Cell | undefined;
  best: ScoredCell | null;
  spacingMeters: number;
  onAnalysePoint: (point: LatLng) => void;
  onHoverPoint: (point: LatLng | null) => void;
}) {
  if (best === null) {
    return (
      <p className="notice" role="status">
        Tidak ada satu pun dari sembilan titik ini yang datanya cukup untuk dinilai.
      </p>
    );
  }

  if (best.id === CENTRE_ID) {
    return (
      <p className="notice notice-neutral" role="status">
        Titik yang Anda pilih adalah yang terbaik di antara sembilan titik ini. Menggeser lokasi beberapa ratus meter
        tidak akan menolong.
      </p>
    );
  }

  const gap = centre?.score == null ? null : Math.round((best.score - centre.score) * 10) / 10;
  const distance = formatDistance(cellDistanceMeters(best.id, spacingMeters));

  return (
    <div className="opportunity-verdict">
      <p>
        Titik terbaik di sekitar sini ada{' '}
        <strong>
          {distance} ke {DIRECTIONS[best.id]}
        </strong>
        , dengan skor <strong>{displayScore(best.score)}</strong>
        {gap !== null && gap > 0 && ` — ${gap.toLocaleString('id-ID', { maximumFractionDigits: 1 })} poin di atas titik Anda`}.
      </p>
      {/* "500 m ke timur laut" is a direction, not a place. Pointing at the
          button that acts on it shows which place is meant. */}
      <button
        type="button"
        className="button-primary"
        onClick={() => onAnalysePoint({ lat: best.lat, lng: best.lng })}
        onMouseEnter={() => onHoverPoint({ lat: best.lat, lng: best.lng })}
        onMouseLeave={() => onHoverPoint(null)}
        onFocus={() => onHoverPoint({ lat: best.lat, lng: best.lng })}
        onBlur={() => onHoverPoint(null)}
      >
        Analisis titik itu
      </button>
    </div>
  );
}
