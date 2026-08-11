import type { Direction } from '../../geometry/direction.ts';
import type { Tile } from '../../geometry/tile.ts';
import type { Maze } from '../../maze/maze.ts';
import type { GlobalMode } from '../../rules/mode-schedule.ts';
import type { Ghost } from '../ghost.ts';

/**
 * The complete list of what a ghost is allowed to know when it picks a target.
 *
 * This type is a wall, not a bag. Blinky may not see the frame counter, Pinky
 * may not see the pellet field, and only Inky is given `blinkyTile` — which is
 * why Inky's rule can be a two-line pure function instead of a lookup into a
 * whole GameState. If a future rule needs something that is not here, that is a
 * deliberate decision with a diff, not an accident.
 */
export interface TargetContext {
  readonly maze: Maze;
  readonly pacmanTile: Tile;
  readonly pacmanFacing: Direction;
  /** Inky needs it; nobody else may look. */
  readonly blinkyTile: Tile;
  readonly mode: GlobalMode;
}

/**
 * "Where do I want to go", as a value.
 *
 * The ghost's own tile is not a parameter because it is already inside `ghost`
 * (Clyde is the only rule that reads it). Splitting "where do I want to go"
 * from "which way do I therefore turn" — see `choose-direction.ts` — is what
 * makes Pinky's overflow bug a single assertion on a single function rather
 * than something you must run a whole game to observe.
 */
export type GhostTargeter = (ghost: Ghost, ctx: TargetContext) => Tile;
