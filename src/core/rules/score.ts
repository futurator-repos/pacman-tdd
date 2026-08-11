/**
 * Adding to the score, and the one thing that can happen when you do.
 *
 * A one-line addition would not deserve a module. The extra life is what does:
 * it is awarded on the CROSSING of 10000, which is a fact about the pair
 * (before, after) and cannot be recovered from the new score alone. Putting the
 * addition and the crossing in the same function means no caller can add points
 * without asking the question, and there is exactly one place in the codebase
 * where the threshold is compared.
 *
 * STUB (slice s08 RED): a fixed inert result. It deliberately does not echo its
 * arguments — a stub that returned the score it was handed would make "adding
 * nothing changes nothing" pass while proving nothing.
 */

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

export function addScore(_score: number, _points: number): ScoreResult {
  return { score: 0, extraLifeAwarded: false };
}
