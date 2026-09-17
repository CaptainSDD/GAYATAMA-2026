import type { BusinessType, LatLng } from '@gayatama/scoring';
import type { UseQueryResult } from '@tanstack/react-query';
import { Loading, QueryError } from '../../components/QueryState';
import type { OpportunitiesResponse } from '../../lib/api-types';
import { scoreTone, toneColor } from '../../lib/band-color';
import { BUSINESS_TYPE_LABELS } from '../../lib/copy';
import { displayScore, formatDistance } from '../../lib/format';
import { CENTRE_ID, COLUMNS, DIRECTIONS, ROWS, bestCell, cellDistanceMeters, type Cell, type ScoredCell } from './grid';

interface OpportunityViewProps {
  query: UseQueryResult<OpportunitiesResponse>;
  businessType: BusinessType;
  onAnalysePoint: (point: LatLng) => void;
}

export function OpportunityView({ query, businessType, onAnalysePoint }: OpportunityViewProps) {
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
              />
            );
          }),
        )}
      </div>
      <p className="opportunity-compass muted" aria-hidden="true">
        Atas = utara
      </p>

      <Verdict centre={centre} best={best} spacingMeters={spacingMeters} onAnalysePoint={onAnalysePoint} />

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
}: {
  cell: Cell;
  isCentre: boolean;
  isBest: boolean;
  onAnalyse: () => void;
}) {
  const direction = DIRECTIONS[cell.id] ?? '';
  const classes = ['opportunity-cell'];
  if (isCentre) classes.push('opportunity-cell-centre');
  if (isBest) classes.push('opportunity-cell-best');

  if (cell.status !== 'scored' || cell.score === null) {
    return (
      <div className={`${classes.join(' ')} opportunity-cell-blank`}>
        <span className="opportunity-direction">{isCentre ? 'Titik Anda' : direction}</span>
        <span className="opportunity-score muted">{cell.status === 'unavailable' ? 'gagal' : 'data tipis'}</span>
      </div>
    );
  }

  const label = `${isCentre ? 'Titik Anda' : `Titik ${direction}`}, skor ${displayScore(cell.score)}`;
  const body = (
    <>
      <span className="opportunity-direction">{isCentre ? 'Titik Anda' : direction}</span>
      <span className="opportunity-score" style={{ color: toneColor(scoreTone(cell.score)) }}>
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
    <button type="button" className={classes.join(' ')} onClick={onAnalyse} aria-label={`${label}. Analisis titik ini`}>
      {body}
    </button>
  );
}

function Verdict({
  centre,
  best,
  spacingMeters,
  onAnalysePoint,
}: {
  centre: Cell | undefined;
  best: ScoredCell | null;
  spacingMeters: number;
  onAnalysePoint: (point: LatLng) => void;
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
      <button type="button" className="button-primary" onClick={() => onAnalysePoint({ lat: best.lat, lng: best.lng })}>
        Analisis titik itu
      </button>
    </div>
  );
}
