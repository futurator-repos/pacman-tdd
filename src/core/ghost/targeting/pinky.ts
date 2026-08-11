import { Direction } from '../../geometry/direction.ts';
import type { Tile } from '../../geometry/tile.ts';

import type { GhostTargeter } from './target-context.ts';

/**
 * The 1980 machine's per-direction offset, one tile's worth.
 *
 * Three of these four rows are the obvious unit steps. The fourth is not, and
 * it is not a typo:
 *
 *   *****************************************************************
 *   UP IS (-1, -1) ON PURPOSE. IT IS THE ARCADE'S BUG, AND IT IS OURS.
 *   The original's position-offset routine added the direction vector to
 *   BOTH axes when the direction was up, so "ahead" while facing up is
 *   also to the LEFT. docs/ARCADE-REFERENCE.md section 6.3.
 *   Do not "fix" it. Every safe spot a player has ever learned exists
 *   BECAUSE of this arithmetic; correcting it would make this game play
 *   differently from the one being reproduced, and fidelity is the
 *   specification here.
 *   *****************************************************************
 *
 * A total `Record` rather than a `switch`: a lookup over a finite union has no
 * default case to leave unreached, which is what keeps this module free of a
 * branch no test can cover.
 */
const AHEAD_STEPS: Readonly<Record<Direction, Tile>> = {
  [Direction.Up]: { col: -1, row: -1 },
  [Direction.Left]: { col: -1, row: 0 },
  [Direction.Down]: { col: 0, row: 1 },
  [Direction.Right]: { col: 1, row: 0 },
};

/**
 * The tile `count` steps ahead of `tile`, overflow included.
 *
 * Exported because the arcade computes Pinky's four-ahead and Inky's two-ahead
 * pivot with the SAME ROM routine (section 6.4), and the bug above must
 * therefore appear in both. Reproducing it twice, once per file, is how a
 * later "tidy-up" fixes one copy and leaves Inky silently disagreeing with the
 * arcade while Pinky's named bug test still passes — the half-fix that survives
 * review. One routine, one place to be faithful.
 *
 * Unclamped: an off-board target is legal and the arcade never clamps one.
 */
export function tilesAhead(tile: Tile, facing: Direction, count: number): Tile {
  const step = AHEAD_STEPS[facing];
  return { col: tile.col + step.col * count, row: tile.row + step.row * count };
}

/**
 * Pinky ("Speedy") aims where Pac-Man is GOING: four tiles ahead of his facing.
 *
 * Four TILES, not four pixels — core works in true arcade tile units so the
 * published tables drop in with no conversion. Aiming ahead rather than at is
 * what produces the pincer with Blinky and the feeling of being cut off at a
 * junction. docs/ARCADE-REFERENCE.md section 6.3.
 */
export const pinkyTarget: GhostTargeter = (_ghost, ctx) =>
  tilesAhead(ctx.pacmanTile, ctx.pacmanFacing, 4);
