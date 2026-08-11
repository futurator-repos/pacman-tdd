import type { Tile } from '../../geometry/tile.ts';
import { GhostId } from '../ghost-id.ts';

/**
 * The four fixed scatter targets, one per ghost.
 *
 * Keyed by GhostId rather than held in an array: `SCATTER_CORNERS.clyde` reads
 * as a fact, `SCATTER_CORNERS[3]` reads as a hope.
 *
 * The values are the ROM's, from docs/ARCADE-REFERENCE.md section 6.1, moved
 * out of the arcade's 28x36 SCREEN space into this codebase's 28x31 PLAYFIELD:
 * the screen's rows 0-2 are the score and 34-35 the lives strip, so the ROM's
 * bottom targets at row 35 have no playfield row and become row 30, the last
 * one. Blinky (25,0) and Pinky (2,0) are untouched. A reader checking Inky
 * against any external source will find (27,35) instead — that is expected,
 * and section 6.1 is why.
 *
 * All four sit on the border wall ring, i.e. OUTSIDE the walkable maze, and
 * that is the whole mechanism of scatter: a ghost can never arrive, so it
 * circles the nearest block until the mode flips. The famous scatter loop is
 * not programmed anywhere — it falls out of an unreachable target.
 */
export const SCATTER_CORNERS: Readonly<Record<GhostId, Tile>> = {
  [GhostId.Blinky]: { col: 25, row: 0 },
  [GhostId.Pinky]: { col: 2, row: 0 },
  [GhostId.Inky]: { col: 27, row: 30 },
  [GhostId.Clyde]: { col: 0, row: 30 },
};
