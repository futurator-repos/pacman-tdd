/**
 * Losing a life: does the round restart, or is the game over?
 *
 * The answer is reported as a VALUE — `respawn` or `gameOver` — rather than as a
 * `RoundPhase` or a `GameEvent`. That is a dependency fact, not a preference:
 * both of those types live in `src/core/game/` (slice s09), and s09 depends on
 * this slice, so importing them here would be a cycle between slices as well as
 * between modules. Translating this outcome into a phase change and a `gameOver`
 * event carrying the final score is `life-system`'s job in slice s11, and is
 * tested there. docs/ARCADE-REFERENCE.md section 13.6 records the split.
 *
 * The starting number of lives is NOT here. It belongs to how a game begins
 * (section 7.1), which is `new-game.ts` in slice s09; this module is only about
 * what happens when one is lost.
 */

/** What happens after the death animation finishes. */
export const LifeOutcome = {
  Respawn: 'respawn',
  GameOver: 'gameOver',
} as const;

export type LifeOutcome = (typeof LifeOutcome)[keyof typeof LifeOutcome];

export interface LifeTransition {
  /** Lives remaining AFTER this death. Never negative. */
  readonly lives: number;
  readonly outcome: LifeOutcome;
}

/**
 * Spend a life.
 *
 * Total over every integer it can be handed, including zero: `loseLife` is a
 * pure function and something has to be true for every input. Zero stays zero
 * and reports game over, because a negative count would draw as `-1` life icons
 * and could never reach the game-over branch — the game would become unloseable
 * by way of a bug that only shows up after a second bug.
 *
 * The branch is asked of what is LEFT rather than of what was there, which is
 * how one comparison serves both the last life and the impossible extra death:
 * `lives > 1` and `lives === 0` are the same question once the life is spent.
 */
export function loseLife(lives: number): LifeTransition {
  const left = Math.max(lives - 1, 0);

  return { lives: left, outcome: left > 0 ? LifeOutcome.Respawn : LifeOutcome.GameOver };
}
