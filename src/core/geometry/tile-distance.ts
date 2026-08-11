import { type Tile } from './tile.ts';

/**
 * SIGNATURE-ONLY STUB — RED phase. No behaviour: see tile.ts for why.
 */

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
 */
export function squaredDistance(_a: Tile, _b: Tile): number {
  return 0;
}
