import { scoreLocation } from './location-score.js';
import type { BusinessType, LocationInput, LocationScoreResult, OperatorOptions } from './types.js';

export interface SimulationResult {
  baseline: LocationScoreResult;
  simulated: LocationScoreResult;
  /** Simulated minus baseline, unrounded. */
  scoreChange: number;
}

/**
 * What-if simulation: rescores with the operator's changes applied on top of
 * their current settings. Rent is deliberately not a variable — it does not
 * change whether customers exist.
 */
export function simulate(
  input: LocationInput,
  businessType: BusinessType,
  changes: OperatorOptions,
  current: OperatorOptions = {},
): SimulationResult {
  const baseline = scoreLocation(input, businessType, current);
  const simulated = scoreLocation(input, businessType, { ...current, ...changes });
  return { baseline, simulated, scoreChange: simulated.score.value - baseline.score.value };
}
