import type { OpportunitiesResponse } from '../../lib/api-types';

export type Cell = OpportunitiesResponse['cells'][number];

/** A cell the engine actually scored, so `score` can be read without a null check. */
export type ScoredCell = Cell & { score: number };

export const CENTRE_ID = '0:0';

/** Grid rows run north to south, so the first row rendered is the north side of the map. */
export const ROWS = [1, 0, -1] as const;
export const COLUMNS = [-1, 0, 1] as const;

/** Cell id is `"row:column"`, where row is metres north and column metres east of the centre. */
export const DIRECTIONS: Record<string, string> = {
  '1:-1': 'barat laut',
  '1:0': 'utara',
  '1:1': 'timur laut',
  '0:-1': 'barat',
  '0:0': 'titik Anda',
  '0:1': 'timur',
  '-1:-1': 'barat daya',
  '-1:0': 'selatan',
  '-1:1': 'tenggara',
};

export function isScored(cell: Cell): cell is ScoredCell {
  return cell.status === 'scored' && cell.score !== null;
}

/** The highest-scoring cell, or `null` when no cell could be scored at all. */
export function bestCell(cells: readonly Cell[]): ScoredCell | null {
  return cells.filter(isScored).reduce<ScoredCell | null>(
    (top, cell) => (top === null || cell.score > top.score ? cell : top),
    null,
  );
}

/**
 * Straight-line distance from the centre. Diagonal cells sit further away than
 * orthogonal ones, so the spacing cannot simply be reported as-is.
 */
export function cellDistanceMeters(id: string, spacingMeters: number): number {
  const [row, column] = id.split(':').map(Number);
  if (row === undefined || column === undefined || Number.isNaN(row) || Number.isNaN(column)) return 0;
  return Math.hypot(row, column) * spacingMeters;
}
