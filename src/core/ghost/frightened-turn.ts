import { type Direction } from '../geometry/direction.ts';
import { type Rng } from '../rng/rng.ts';

/**
 * The pseudo-random turn a frightened ghost takes, and nothing else.
 *
 * Note what is absent from the signature: the maze, the ghost, its facing and
 * its target. A frightened ghost has no target — that is the whole of fright —
 * and the walls have already been consulted by the caller, which passes the
 * exits it found. This module's entire job is to pick one of them, so it can
 * be tested with an array literal and a scripted `Rng`.
 *
 * `legal` arrives in `ALL_DIRECTIONS` order because `walkableNeighbours`
 * returns it that way. That is part of the contract rather than a coincidence:
 * the index the draw selects is only reproducible if the list it indexes is
 * ordered. docs/ARCADE-REFERENCE.md section 10, "Frightened turns".
 *
 * EXACTLY ONE DRAW PER DECISION, which is why the exits are filtered by the
 * caller and indexed here rather than drawn and retried until one is legal.
 * That count is a contract of `src/core/game/replay.ts` rather than an arcade
 * fact: a seeded stream reproduces a game only if it is consumed identically,
 * so a second draw for a rejected candidate would shift every later ghost turn
 * in the run.
 *
 * THE FOLD IS THE LOOKUP, and it is not a flourish. `legal[draw]` is
 * `Direction | undefined` under `noUncheckedIndexedAccess`, and both ways out of
 * that are closed here: a `?? somewhere` fallback is a branch no test can reach,
 * which the coverage gate forbids, and the type assertion that removes the
 * `undefined` is precisely the one eslint asks to be rewritten as `!`, which is
 * banned. `reduce` with no seed starts from the first exit and replaces it only
 * at the index the draw names, so the nth element comes back as a plain
 * `Direction` with nothing to fall back to. An empty `legal` means the caller
 * found no exits at all; `nextInt(0)` throws on it rather than inventing a
 * direction the walls do not allow.
 */
export function chooseFrightenedDirection(rng: Rng, legal: readonly Direction[]): Direction {
  const draw = rng.nextInt(legal.length);
  return legal.reduce((chosen, direction, index) => (index === draw ? direction : chosen));
}
