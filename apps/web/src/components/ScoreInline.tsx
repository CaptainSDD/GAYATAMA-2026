import type { ScoreSummary } from '@gayatama/scoring';
import { displayScore, formatRange } from '../lib/format';

/** Compact ranking score with its uncertainty available on every input method. */
export function ScoreInline({ score }: { score: ScoreSummary }) {
  return (
    <span className="score-inline" aria-label={`Skor ${displayScore(score.value)} dari 100, rentang ${formatRange(score)}`}>
      <span><strong>{displayScore(score.value)}</strong>/100</span>
      <small>{formatRange(score)}</small>
    </span>
  );
}
