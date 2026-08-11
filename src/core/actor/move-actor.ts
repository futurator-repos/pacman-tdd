/**
 * The movement engine: sub-pixel carry, cornering, the wall stop and the
 * tunnel wrap — for all five actors, in one place.
 *
 * Everything positional lives here and nowhere else, which is what lets ghost
 * AI and Pac-Man's input handling be pure decisions over tiles: they hand in a
 * `TurnPolicy` and never touch a pixel. The consequence worth stating is that a
 * geometry bug has exactly one file to be in.
 */
import { toUnitVector } from '../geometry/direction.ts';
import { TILE_SIZE, type Tile, tileAt, tileEquals } from '../geometry/tile.ts';
import { type Vector2 } from '../geometry/vector.ts';
import { type Maze, isWalkable, wrapPosition } from '../maze/maze.ts';

import {
  SUBPIXELS_PER_PIXEL,
  type Actor,
  type MoveRequest,
  type MoveResult,
  type TurnPolicy,
  isAtTileCentre,
  tileOf,
} from './actor.ts';

/**
 * The tile one whole tile ahead, as a position rather than as a tile step.
 *
 * Written this way — advance the PIXEL position by `TILE_SIZE` and wrap it —
 * rather than as `neighbour(tile, facing)`, because the neighbour of column 0
 * is column -1, which every maze answers as `Wall`. An actor arriving at the
 * tunnel mouth would then be told it is facing a wall and would stop dead in
 * the one place the board is supposed to be continuous.
 */
function tileAhead(maze: Maze, position: Vector2, step: Vector2): Tile {
  return tileAt(
    wrapPosition(maze, {
      x: position.x + step.x * TILE_SIZE,
      y: position.y + step.y * TILE_SIZE,
    }),
  );
}

/**
 * Advance one actor by one frame.
 *
 * The frame's travel is resolved ONE PIXEL AT A TIME, asking the policy before
 * each pixel, and that is the load-bearing decision here rather than an
 * implementation detail. A mover that decided once per frame would sail past a
 * junction whenever an actor is faster than a pixel per frame — which is only
 * Cruise Elroy and a ghost's eyes, so it would present as "the ghosts get stuck
 * circling late in a level" and never point back here.
 *
 * Three smaller decisions the tests leave room for, recorded because a later
 * reader will otherwise assume they were accidents:
 *   - the carry is banked as `(carry + step) % 256` BEFORE any movement, so a
 *     frame that moves nothing still accumulates, and a frame that is blocked
 *     simply discards the pixels it could not deliver;
 *   - `queued` is never cleared here. A request the corridor cannot satisfy
 *     survives until it can be, which is what makes cornering feel like the
 *     arcade instead of demanding frame-perfect timing;
 *   - the wall stop is evaluated only ON a tile centre, which is what leaves an
 *     actor flush on the last walkable centre rather than jammed against the
 *     wall face off-grid, unable to ever turn again.
 */
export function moveActor(request: MoveRequest, turn: TurnPolicy): MoveResult {
  const { maze, mayPassDoor } = request;
  const totalSubPixels = request.actor.carrySubPixels + request.stepSubPixels;
  const wholePixels = Math.floor(totalSubPixels / SUBPIXELS_PER_PIXEL);

  let actor: Actor = { ...request.actor, carrySubPixels: totalSubPixels % SUBPIXELS_PER_PIXEL };
  let enteredTile: Tile | null = null;
  let blocked = false;
  let turned = false;

  for (let pixel = 0; pixel < wholePixels; pixel += 1) {
    const tile = tileOf(actor);
    const atTileCentre = isAtTileCentre(actor);

    /* Asked before the wall check, so a reversal — which is legal at any pixel,
       not just at a centre — turns the actor round rather than jamming it. */
    const facing = turn({ actor, tile, atTileCentre, maze, mayPassDoor });
    if (facing !== actor.facing) {
      actor = { ...actor, facing };
      turned = true;
    }

    const step = toUnitVector(facing);
    if (atTileCentre && !isWalkable(maze, tileAhead(maze, actor.position, step), mayPassDoor)) {
      blocked = true;
      break;
    }

    const position = wrapPosition(maze, {
      x: actor.position.x + step.x,
      y: actor.position.y + step.y,
    });
    actor = { ...actor, position };

    const reached = tileAt(position);
    if (!tileEquals(reached, tile)) {
      enteredTile = reached;
    }
  }

  return { actor, enteredTile, blocked, turned };
}
