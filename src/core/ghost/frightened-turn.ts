import { Direction } from '../geometry/direction.ts';
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
 * SIGNATURE-ONLY STUB — no behaviour. It draws NOTHING from the `Rng`, which
 * is exactly what makes the "consumes exactly one draw per decision" test fail
 * honestly: the scripted script is never exhausted, so the call that should
 * throw does not. The inert `Direction.Right` is chosen for the reason given in
 * `choose-direction.ts`.
 */
export function chooseFrightenedDirection(_rng: Rng, _legal: readonly Direction[]): Direction {
  return Direction.Right;
}
