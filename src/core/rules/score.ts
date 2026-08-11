/**
 * Adding to the score, and the one thing that can happen when you do.
 *
 * A one-line addition would not deserve a module. The extra life is what does:
 * it is awarded on the CROSSING of 10000, which is a fact about the pair
 * (before, after) and cannot be recovered from the new score alone. Putting the
 * addition and the crossing in the same function means no caller can add points
 * without asking the question, and there is exactly one place in the codebase
 * where the threshold is compared.
 */
import { EXTRA_LIFE_AT } from './points.ts';

/** The new score, and whether THIS addition earned the extra life. */
export interface ScoreResult {
  readonly score: number;
  /**
   * True on the single addition that took the score across 10000, and false on
   * every other addition — including all the ones after it. The score only ever
   * increases, so the crossing happens at most once per game, which is what
   * "one bonus life" means. docs/ARCADE-REFERENCE.md section 13.3.
   */
  readonly extraLifeAwarded: boolean;
}

/**
 * Add points, and report the crossing.
 *
 * Both ends of the crossing are asserted rather than just the new total,
 * because each half alone is a bug the other half hides: `after >= threshold`
 * pays a life for every scoring event once the player is past 10000, and
 * `before < threshold` pays one for every dot before it. The `>=` on the second
 * half — rather than `===` — is what awards the life when a 3000-point chain
 * leaps the line without ever landing on it. docs/ARCADE-REFERENCE.md 13.3.
 */
export function addScore(score: number, points: number): ScoreResult {
  const after = score + points;

  return {
    score: after,
    extraLifeAwarded: score < EXTRA_LIFE_AT && after >= EXTRA_LIFE_AT,
  };
}
