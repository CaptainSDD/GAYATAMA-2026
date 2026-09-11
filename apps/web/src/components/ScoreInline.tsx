import type { ScoreSummary } from '@gayatama/scoring';
import { displayScore, formatRange } from '../lib/format';

/** A score with its interval, for lists. It never renders a bare number. */
export function ScoreInline({ score }: { score: ScoreSummary }) {
  return (
    <span className="score-inline">
      <strong>{displayScore(score.value)}</strong> ± {score.margin}
      <span className="muted"> ({formatRange(score)})</span>
    </span>
  );
}
