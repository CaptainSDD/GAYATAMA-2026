import type { OpportunitiesResponse } from '../../lib/api-types';

export type Cell = OpportunitiesResponse['cells'][number];

/** A cell the engine actually scored, so `score` can be read without a null check. */
export type ScoredCell = Cell & { score: number };

export function isScored(cell: Cell): cell is ScoredCell {
  return cell.status === 'scored' && cell.score !== null;
}

/**
 * The highest-scoring cell, or `null` when no cell could be scored at all.
 * Nothing in this grid is a privileged "your point" — the visitor has not
 * picked one yet — so the best cell is just the best score, full stop.
 */
export function bestCell(cells: readonly Cell[]): ScoredCell | null {
  return cells.filter(isScored).reduce<ScoredCell | null>(
    (top, cell) => (top === null || cell.score > top.score ? cell : top),
    null,
  );
}

/**
 * The `n` highest-scoring cells, best first. A cell that could not be scored
 * is excluded rather than shown with a fabricated rank — if fewer than `n`
 * were scored, the caller gets fewer than `n` back, not padding.
 */
export function topScored(cells: readonly Cell[], n: number): ScoredCell[] {
  return cells.filter(isScored).sort((a, b) => b.score - a.score).slice(0, n);
}
