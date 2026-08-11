import type { Tile } from '../../geometry/tile.ts';
import { GhostId } from '../ghost-id.ts';

/**
 * The four fixed scatter targets, one per ghost.
 *
 * Keyed by GhostId rather than held in an array: `SCATTER_CORNERS.clyde` reads
 * as a fact, `SCATTER_CORNERS[3]` reads as a hope.
 */
/* STUB — slice s05 RED phase. Four inert origin tiles, no data. The real
   coordinates live in scatter-corners.test.ts, which is where they belong in a
   red phase: in the expectation, not in the code. */
export const SCATTER_CORNERS: Readonly<Record<GhostId, Tile>> = {
  [GhostId.Blinky]: { col: 0, row: 0 },
  [GhostId.Pinky]: { col: 0, row: 0 },
  [GhostId.Inky]: { col: 0, row: 0 },
  [GhostId.Clyde]: { col: 0, row: 0 },
};
