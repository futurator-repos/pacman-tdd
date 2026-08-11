/**
 * Pac-Man's `TurnPolicy`: the rule that makes the controls feel responsive.
 *
 * The rule, in the order the checks are written, because THAT ORDER IS THE RULE
 * (docs/ARCADE-REFERENCE.md section 8.4):
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
 *
 * What this file never does is CLEAR the queue. `move-actor.ts` does not clear
 * it either, so a request the corridor cannot yet satisfy survives every pixel
 * until it can be taken — which is the whole of "the turn I pressed early was
 * remembered" and the reason cornering does not demand frame-perfect input.
 */
import { type TurnContext } from '../actor/actor.ts';
import { type Direction, isOpposite } from '../geometry/direction.ts';
import { neighbour } from '../geometry/tile.ts';
import { isWalkable } from '../maze/maze.ts';

/** Which way Pac-Man leaves the pixel he is standing on. */
export function pacmanTurnPolicy(ctx: TurnContext): Direction {
  const { actor, maze, mayPassDoor } = ctx;
  const queued = actor.queued;

  if (queued === null) {
    return actor.facing;
  }
  if (!isWalkable(maze, neighbour(ctx.tile, queued), mayPassDoor)) {
    return actor.facing;
  }
  if (isOpposite(actor.facing, queued)) {
    return queued;
  }
  return ctx.atTileCentre ? queued : actor.facing;
}
