import { describe, expect, it } from 'vitest';

import type { Tile } from '../../geometry/tile.ts';
import { ARCADE_MAZE } from '../../maze/arcade-maze.ts';
import { isWalkable } from '../../maze/maze.ts';
import { GhostId } from '../ghost-id.ts';

import { SCATTER_CORNERS } from './scatter-corners.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * Scatter is the part of the game a skilled player can predict: every twenty
 * seconds or so the ghosts stop chasing and head for four fixed corners, which
 * is the window in which the board can be crossed safely. The corners must be
 * exactly the arcade's, and — this is the interesting part — they are
 * deliberately UNREACHABLE.
 *
 * A ghost cannot stand on a corner target, so it never "arrives" and never
 * needs a special case for having arrived. It simply circles the block nearest
 * that corner until the mode flips back to chase. The famous scatter loop is
 * not programmed anywhere; it falls out of an unreachable target plus the
 * ordinary "step to the neighbour nearest my target" rule.
 *
 * ---------------------------------------------------------------------------
 * COORDINATE SPACES, AND WHY THE BOTTOM TWO ARE NOT ROW 35
 *
 * The arcade's tile grid covers the WHOLE 224x288 screen: 28 columns by 36
 * rows, of which rows 0-2 are the score display, rows 3-33 are the maze, and
 * rows 34-35 are the lives and fruit strip. The ROM's scatter targets in that
 * screen space are:
 *
 *     Blinky (25,  0)   Pinky (2,  0)   Inky (27, 35)   Clyde (0, 35)
 *
 * This codebase's `Maze` is the PLAYFIELD only — 28 columns by 31 rows — and it
 * places those four targets on the playfield's own border ring: the top row for
 * Blinky and Pinky, the bottom row for Inky and Clyde. That is the convention
 * `src/core/maze/parse-maze.ts` derives from any board it is given —
 * Blinky (columns-3, 0), Pinky (2, 0), Inky (columns-1, rows-1),
 * Clyde (0, rows-1) — so `ARCADE_MAZE.scatterTargets` and the constants here
 * describe the same four tiles. Two modules holding the same fact in different
 * coordinate spaces would be a bug that no single test could see; the second
 * test below is where the two are brought together.
 *
 * The border ring is solid wall on the classic board, so these tiles are
 * unreachable exactly as the ROM's off-screen ones are, and the circling
 * behaviour is preserved.
 * ---------------------------------------------------------------------------
 */

const BLINKY_CORNER: Tile = { col: 25, row: 0 };
const PINKY_CORNER: Tile = { col: 2, row: 0 };
const INKY_CORNER: Tile = { col: 27, row: 30 };
const CLYDE_CORNER: Tile = { col: 0, row: 30 };

describe('SCATTER_CORNERS', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: four constants. There is nothing to integrate, and nothing
   *   slower could add information — the interesting consequence (a ghost
   *   circles rather than arrives) follows from unreachability, which the
   *   second test states directly.
   * MEASURES: the exact tile each ghost heads for during scatter, keyed by
   *   GhostId so a swap between two ghosts is visible in the diff.
   * ORACLE: docs/ARCADE-REFERENCE.md's scatter-corner table — the ROM's four
   *   values, Blinky (25,0), Pinky (2,0), Inky (27,35), Clyde (0,35) in 28x36
   *   screen space, placed on this codebase's 31-row playfield border ring per
   *   the note above. Blinky and Pinky take the TOP corners, Inky and Clyde the
   *   bottom, and Pinky's is the top LEFT: the four are not interchangeable and
   *   the ghosts' scatter routes differ because of it.
   * CATCHES: a corner moved a tile into a corridor, or two ghosts' corners
   *   swapped. The ghost reaches its target, the "nearest neighbour" rule has
   *   nothing left to prefer, and the predictable scatter loop degenerates into
   *   a jitter at the corner — a behavioural bug with no crash, no exception
   *   and no other failing test.
   * LOAD-BEARING: yes — the stub returns four origin tiles.
   */
  it('are the four arcade corners, keyed by ghost', () => {
    expect(SCATTER_CORNERS).toEqual({
      [GhostId.Blinky]: BLINKY_CORNER,
      [GhostId.Pinky]: PINKY_CORNER,
      [GhostId.Inky]: INKY_CORNER,
      [GhostId.Clyde]: CLYDE_CORNER,
    });
  });

  /**
   * TYPE: integration (two slices' modules in one assertion), deliberately
   *   cheap — still pure core, still microseconds, still no game loop.
   * WHY THIS TYPE: this is the ONE claim in this file that cannot be made by
   *   either slice alone. `SCATTER_CORNERS` is this slice's; `ARCADE_MAZE` and
   *   `isWalkable` are slice s02's. Unreachability is a relationship BETWEEN
   *   them, so a unit test of either module in isolation cannot state it, and
   *   this is the cheapest test that can.
   * MEASURES: that no scatter corner is a tile a ghost could ever stand on.
   * ORACLE: docs/ARCADE-REFERENCE.md — the scatter targets sit outside the
   *   walkable maze. Unreachability is the mechanism by which scatter produces
   *   a stable loop rather than an arrival, and it is also what makes the
   *   coordinate-space question above matter: a corner that landed inside a
   *   corridor would satisfy the first test and still break the game.
   * CATCHES: the two slices drifting apart — s05 holding the corners in
   *   screen-space rows and s02 deriving them in playfield rows, or someone
   *   clamping a corner "into the board for safety". The ghost then arrives at
   *   its target, stops steering coherently, and the scatter window a player
   *   relies on stops being predictable.
   * LOAD-BEARING: NO, and this is worth reading carefully. `isWalkable` is
   *   currently slice s02's RED-phase stub returning `false` unconditionally,
   *   so this test passes today no matter what SCATTER_CORNERS contains. By
   *   docs/TDD-FINDINGS.md's classification that is (b) WEAK — trivially
   *   satisfied by a constant — not (a) vacuous: the assertion really does
   *   execute, four times. It is kept because the day s02 goes green it becomes
   *   the genuine convergence check described above, and a test that only earns
   *   its keep later is better than a fact nobody checks at all. Recorded here
   *   rather than discovered by a reader wondering why it was green from the
   *   first run.
   */
  it('all sit outside the walkable maze, so no ghost can ever arrive at one', () => {
    /* Vacuity guard: four corners, one assertion each. */
    expect.assertions(4);

    for (const corner of Object.values(SCATTER_CORNERS)) {
      /* mayPassDoor false: even a ghost, which may cross the house gate, has
         no business standing on a scatter corner. */
      expect(isWalkable(ARCADE_MAZE, corner, false)).toBe(false);
    }
  });
});
