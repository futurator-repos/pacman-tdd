import { tilesAhead } from './pinky.ts';
import type { GhostTargeter } from './target-context.ts';

/**
 * Inky ("Bashful") is the only ghost whose target depends on another ghost.
 *
 * Two steps, per docs/ARCADE-REFERENCE.md section 6.4:
 *
 *   1. PIVOT on the tile two ahead of Pac-Man's facing — via `tilesAhead`, so
 *      the pivot inherits the same up-overflow Pinky has (facing up gives two
 *      up AND two left). Deliberate arcade fidelity; see the warning in
 *      `pinky.ts` before touching it.
 *   2. DOUBLE the vector from Blinky's tile through that pivot:
 *      target = pivot + (pivot - blinky), written out as `2 * pivot - blinky`
 *      so there is no intermediate vector to get the sign of wrong.
 *
 * Reading Blinky's tile rather than his own is the single most commonly
 * mis-implemented part of this ghost, and it is the reason `blinkyTile` is on
 * TargetContext at all. It is also why the pincer is emergent rather than
 * scripted: while Blinky is far away the doubled vector flings Inky's target
 * far past Pac-Man, so Inky loops wide and only closes in once Blinky is close.
 *
 * The result is returned unclamped. An off-board target is legal — the ghost
 * simply steers toward it, exactly as it does toward a scatter corner.
 */
export const inkyTarget: GhostTargeter = (_ghost, ctx) => {
  const pivot = tilesAhead(ctx.pacmanTile, ctx.pacmanFacing, 2);
  return {
    col: pivot.col * 2 - ctx.blinkyTile.col,
    row: pivot.row * 2 - ctx.blinkyTile.row,
  };
};
