import { squaredDistance } from '../../geometry/tile-distance.ts';
import { tileAt } from '../../geometry/tile.ts';
import { GhostId } from '../ghost-id.ts';

import { SCATTER_CORNERS } from './scatter-corners.ts';
import type { GhostTargeter } from './target-context.ts';

/**
 * Eight tiles, squared. The arcade never takes a square root, so the boundary
 * lives in the code as 64 rather than as 8 — which also keeps the comparison
 * in exact integers, where a tie is a tie rather than a float coin-toss.
 */
const COWARDICE_RADIUS_SQUARED = 64;

/**
 * Clyde ("Pokey") chases like Blinky from afar and loses his nerve up close.
 *
 * Strictly GREATER than 64 chases; 64 itself retreats. The Dossier's prose is
 * silent at exactly eight tiles, and docs/ARCADE-REFERENCE.md section 6.5
 * records this codebase's reading — the boundary belongs to the retreat — as a
 * repo convention rather than a transcription.
 *
 * `squaredDistance` sums BOTH axes: the radius is a radius, not a column gap
 * and not a city-block walk. Clyde is the only personality that reads his own
 * position, which is why he alone needs `tileAt` on the ghost's pixel position.
 *
 * The retreat target is the shared `SCATTER_CORNERS` constant and NOT
 * `ctx.maze.scatterTargets`: this rule fires in the middle of a CHASE wave, so
 * the corner is a property of the ghost, and one source for it is what stops
 * the two from drifting apart. His cowardice is what makes the bottom-left of
 * the board the safe spot an expert player parks in.
 */
export const clydeTarget: GhostTargeter = (ghost, ctx) =>
  squaredDistance(tileAt(ghost.actor.position), ctx.pacmanTile) > COWARDICE_RADIUS_SQUARED
    ? ctx.pacmanTile
    : SCATTER_CORNERS[GhostId.Clyde];
