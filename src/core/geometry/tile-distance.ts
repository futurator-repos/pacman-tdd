import { type Tile } from './tile.ts';

/**
 * The SQUARED Euclidean distance between two tiles, in tiles squared.
 *
 * Squared, never square-rooted. Two reasons, and both are load-bearing:
 *
 * 1. Ghost turn selection picks the neighbour tile nearest its target and
 *    breaks exact ties by direction order. `Math.sqrt` would turn exact
 *    integers into floats, and two genuinely equal distances could then differ
 *    in the last bit — making the tie-break, and therefore replay, unstable.
 * 2. Clyde's rule has its boundary at eight tiles, which the arcade compares as
 *    64. Keeping the comparison squared keeps that literal 64 in the code.
 *
 * Nothing is lost by omitting the root: squaring is monotonic on non-negative
 * numbers, so squared distances rank candidate tiles in exactly the order real
 * distances would.
 */
export function squaredDistance(a: Tile, b: Tile): number {
  const columnGap = a.col - b.col;
  const rowGap = a.row - b.row;
  return columnGap * columnGap + rowGap * rowGap;
}
