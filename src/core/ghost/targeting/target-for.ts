import type { Tile } from '../../geometry/tile.ts';
import { GlobalMode } from '../../rules/mode-schedule.ts';
import { GhostId } from '../ghost-id.ts';
import { type Ghost, GhostPhase } from '../ghost.ts';

import { blinkyTarget } from './blinky.ts';
import { clydeTarget } from './clyde.ts';
import { inkyTarget } from './inky.ts';
import { pinkyTarget } from './pinky.ts';
import { SCATTER_CORNERS } from './scatter-corners.ts';
import type { GhostTargeter, TargetContext } from './target-context.ts';

/**
 * The four personalities, as data.
 *
 * A total `Record` rather than a `switch`: there is no default case to leave
 * unreached, and adding a fifth ghost would be a type error here instead of a
 * silent fall-through somewhere in the middle of a level.
 */
const PERSONALITIES: Readonly<Record<GhostId, GhostTargeter>> = {
  [GhostId.Blinky]: blinkyTarget,
  [GhostId.Pinky]: pinkyTarget,
  [GhostId.Inky]: inkyTarget,
  [GhostId.Clyde]: clydeTarget,
};

/**
 * The one dispatch point from a ghost's id and phase to the tile it steers for.
 *
 * The ORDER OF THE QUESTIONS is the whole content of this function, and it is
 * phase before mode before personality:
 *
 *   1. Are these eyes going home? -> the house door, whatever the mode is.
 *   2. Is the global mode scatter? -> this ghost's fixed corner.
 *   3. Otherwise -> ask the personality.
 *
 * Backwards, an eaten Blinky's eyes chase Pac-Man instead of going home, never
 * re-enter the house, never regenerate, and the level quietly continues with
 * three ghosts — a bug with no crash to find it by.
 *
 * InHouse and LeavingHouse get no case of their own: they fall through to mode
 * and personality like any hunting ghost, because a ghost's route out of the
 * house is `choose-direction.ts`'s business, not this function's.
 *
 * The scatter corner comes from `SCATTER_CORNERS`, not from
 * `ctx.maze.scatterTargets` — see the note in `clyde.ts`. The house door comes
 * from the maze, because that IS a property of the board.
 */
export function targetFor(ghost: Ghost, ctx: TargetContext): Tile {
  if (ghost.phase === GhostPhase.Eyes || ghost.phase === GhostPhase.EnteringHouse) {
    return ctx.maze.houseDoorTile;
  }
  if (ctx.mode === GlobalMode.Scatter) {
    return SCATTER_CORNERS[ghost.id];
  }
  return PERSONALITIES[ghost.id](ghost, ctx);
}
