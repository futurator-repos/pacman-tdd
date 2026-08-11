/**
 * Pac-Man's `TurnPolicy`: the rule that makes the controls feel responsive.
 *
 * SIGNATURE-ONLY STUB — slice s07 RED phase. Returning the current facing is
 * the inert answer, and docs/TEST-PLAN.md predicts in advance which tests it
 * will satisfy: the "nothing queued" and "queued turn is illegal" cases pass
 * against it, which is exactly why those two are labelled guards rather than
 * load-bearing.
 *
 * The rule this file will implement, stated once here so the stub cannot be
 * mistaken for it (docs/ARCADE-REFERENCE.md section 8.4):
 *
 *   1. nothing queued            -> keep facing (letting go of the joystick
 *                                   does not stop Pac-Man)
 *   2. the tile the queue points at is not walkable, asked with the CONTEXT's
 *      `mayPassDoor`             -> keep facing, and keep the queue for later
 *   3. the queue is a REVERSAL   -> take it now, at whatever pixel he is on
 *   4. otherwise                 -> take it only on a tile centre
 *
 * THE ORDER OF 2 BEFORE 3 IS LOAD-BEARING, and `pacman-turn.test.ts` pins it.
 * The reversal exception frees a turn from the TILE-CENTRE requirement only —
 * never from the walkability check. Section 8.4's "applied immediately, at
 * whatever pixel Pac-Man occupies" is a statement about the centre rule, not
 * about walls. The door test builds the single context where the two orderings
 * disagree (below the gate, facing down, with up queued — which is at once a
 * reversal and a blocked direction) and requires `down` while permission is
 * refused. A policy that returns the reversal before consulting `isWalkable`
 * answers `up` there and fails.
 */
import { type TurnContext } from '../actor/actor.ts';
import { type Direction } from '../geometry/direction.ts';

/** Which way Pac-Man leaves the pixel he is standing on. */
export function pacmanTurnPolicy(ctx: TurnContext): Direction {
  return ctx.actor.facing;
}
