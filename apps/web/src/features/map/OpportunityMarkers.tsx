import type { LatLng } from '@gayatama/scoring';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { Fragment } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { scoreTone, toneColor } from '../../lib/band-color';
import { displayScore } from '../../lib/format';
import { bestCell, type Cell } from '../opportunity/grid';

export interface OpportunityMarkersProps {
  cells: readonly Cell[];
  onAnalysePoint: (point: LatLng) => void;
}

/** What each point shows, decided once so both map engines cannot disagree. */
interface PointView {
  cell: Cell;
  isBest: boolean;
  /** null when the cell was never scored, which is not the same as scoring badly. */
  score: number | null;
  fillColor: string | null;
  label: string;
}

function describe(cells: readonly Cell[]): PointView[] {
  const best = bestCell(cells);

  return cells.map((cell) => {
    const isBest = best !== null && cell.id === best.id;
    const scored = cell.status === 'scored' && cell.score !== null;

    return {
      cell,
      isBest,
      score: scored ? cell.score : null,
      fillColor: scored ? toneColor(scoreTone(cell.score as number)) : null,
      label: scored
        ? `${cell.label}, skor ${displayScore(cell.score as number)}. Analisis titik ini`
        : `${cell.label}, data peta belum cukup untuk dinilai`,
    };
  });
}

export function LeafletOpportunityMarkers({ cells, onAnalysePoint }: OpportunityMarkersProps) {
  return (
    <>
      {describe(cells).map((view) => {
        const clickable = view.score !== null;
        return (
          <CircleMarker
            key={view.cell.id}
            center={[view.cell.lat, view.cell.lng]}
            radius={view.isBest ? 10 : 8}
            pathOptions={{
              color: '#ffffff',
              weight: view.isBest ? 2.5 : 1.5,
              fillColor: view.fillColor ?? '#94a3b8',
              fillOpacity: view.fillColor === null ? 0.45 : 0.9,
            }}
            interactive={clickable}
            eventHandlers={clickable ? { click: () => onAnalysePoint({ lat: view.cell.lat, lng: view.cell.lng }) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {view.label}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

export function GoogleOpportunityMarkers({ cells, onAnalysePoint }: OpportunityMarkersProps) {
  return (
    <>
      {describe(cells).map((view) => {
        const clickable = view.score !== null;
        const size = view.isBest ? 22 : 18;
        return (
          <Fragment key={view.cell.id}>
            <AdvancedMarker
              position={{ lat: view.cell.lat, lng: view.cell.lng }}
              clickable={clickable}
              anchorLeft="-50%"
              anchorTop="-50%"
              title={view.label}
              onClick={() => {
                if (clickable) onAnalysePoint({ lat: view.cell.lat, lng: view.cell.lng });
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  border: `${view.isBest ? 3 : 2}px solid #ffffff`,
                  background: view.fillColor ?? '#94a3b8',
                  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.45)',
                  cursor: clickable ? 'pointer' : 'default',
                }}
              />
            </AdvancedMarker>
          </Fragment>
        );
      })}
    </>
  );
}
