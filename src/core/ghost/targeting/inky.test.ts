import { describe, expect, it } from 'vitest';

import { Direction } from '../../geometry/direction.ts';
import type { Tile } from '../../geometry/tile.ts';
import { GhostId } from '../ghost-id.ts';
import { type Ghost, GhostPhase } from '../ghost.ts';

import { inkyTarget } from './inky.ts';
import type { TargetContext } from './target-context.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * Inky is the only ghost whose target depends on ANOTHER ghost, and that is
 * what makes him unpredictable: the same Pac-Man position gives a different
 * answer depending on where Blinky happens to be. It is also why `blinkyTile`
 * exists on TargetContext at all.
 *
 * His rule, in two steps (docs/ARCADE-REFERENCE.md):
 *
 *   1. PIVOT — the tile TWO ahead of Pac-Man's facing. Two, not Pinky's four,
 *      and computed by the same ROM routine, so it inherits the same
 *      up-overflow: facing up, the pivot is two up AND two left.
 *   2. DOUBLE — draw the vector from Blinky's tile to the pivot, then extend it
 *      to twice its length. Equivalently: target = pivot + (pivot - blinky).
 *
 *      blinky ----------> pivot ----------> target
 *             one vector         the same vector again
 *
 * The consequence worth understanding: when Blinky is far from Pac-Man, Inky's
 * target is flung far past him — which is why Inky loops wide and only closes
 * in when Blinky is already close. The pincer is emergent, not scripted.
 */

const ORIGIN: Tile = { col: 0, row: 0 };

/** Inky's rule never reads the maze; TargetContext requires one. See the longer
 *  explanation of this fixture in blinky.test.ts. */
const IRRELEVANT_MAZE = {
  columns: 0,
  rows: 0,
  tiles: [],
  pelletTiles: [],
  powerPelletTiles: [],
  noUpTiles: new Set<number>(),
  pacmanSpawn: ORIGIN,
  ghostSpawns: { blinky: ORIGIN, pinky: ORIGIN, inky: ORIGIN, clyde: ORIGIN },
  scatterTargets: { blinky: ORIGIN, pinky: ORIGIN, inky: ORIGIN, clyde: ORIGIN },
  houseDoorTile: ORIGIN,
  houseCentreTile: ORIGIN,
  fruitTile: ORIGIN,
  tunnelRow: 0,
};

/** Inky himself. His own position is not an input to his rule — the vector is
 *  drawn from BLINKY, which is the single most commonly mis-implemented part of
 *  this ghost, so his own tile is parked somewhere that would give obviously
 *  different (and obviously wrong) numbers if it were read by mistake. */
const INKY: Ghost = {
  id: GhostId.Inky,
  actor: {
    position: { x: 4, y: 244 },
    facing: Direction.Up,
    queued: null,
    carrySubPixels: 0,
  },
  phase: GhostPhase.Hunting,
  frightenedFramesLeft: 0,
  dotCounter: 0,
  dotCounterActive: false,
  elroyStage: 0,
  reverseQueued: false,
};

function context(pacmanTile: Tile, pacmanFacing: Direction, blinkyTile: Tile): TargetContext {
  return { maze: IRRELEVANT_MAZE, pacmanTile, pacmanFacing, blinkyTile, mode: 'chase' };
}

describe('inkyTarget', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: pure two-input geometry. A unit can hand-place Blinky and
   *   Pac-Man so the doubling arithmetic is checkable by eye. Through the game
   *   it would need a contrived state, and the failure would not say which half
   *   — the pivot or the doubling — was wrong.
   * MEASURES: with Pac-Man at (12,14) facing right and Blinky at (10,16):
   *   pivot = (12+2, 14) = (14,14); target = pivot + (pivot - blinky)
   *   = (14 + 4, 14 - 2) = (18, 12).
   * ORACLE: docs/ARCADE-REFERENCE.md — Inky (Aosuke, "Bashful") takes the tile
   *   two ahead of Pac-Man, draws the vector from Blinky's tile to it, and
   *   doubles that vector.
   * CATCHES: the vector drawn from Pac-Man instead of from Blinky, or not
   *   doubled at all. Inky degenerates into a second Blinky, the pincer that
   *   makes him distinctive disappears, and every other ghost test stays green.
   * LOAD-BEARING: yes — the stub returns {col: 0, row: 0}.
   */
  it('doubles the vector from blinky through the tile two ahead of pac-man', () => {
    const target = inkyTarget(
      INKY,
      context({ col: 12, row: 14 }, Direction.Right, { col: 10, row: 16 }),
    );

    expect(target).toEqual({ col: 18, row: 12 });
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: the same pure function on the one facing that behaves
   *   differently. Separate from the case above so the failure message names
   *   the overflow rather than "inky is wrong".
   * MEASURES: with Pac-Man at (12,14) facing UP and Blinky at (14,16):
   *   pivot = (12-2, 14-2) = (10,12)   <- two up AND two left
   *   target = (10 + (10-14), 12 + (12-16)) = (6, 8).
   *   Without the overflow the pivot would be (12,12) and the target (10,8), so
   *   this fixture distinguishes the two answers rather than merely exercising
   *   the code path.
   * ORACLE: docs/ARCADE-REFERENCE.md — the pivot uses the SAME position-offset
   *   routine as Pinky's four-ahead, and that routine adds the offset to both
   *   axes when the direction is up. Inky therefore inherits the 1980 hardware
   *   overflow. Deliberate fidelity, not a defect in this codebase — see the
   *   long note in pinky.test.ts.
   * CATCHES: the overflow implemented in pinky.ts only. Inky's up-corridor
   *   behaviour would then diverge from the arcade while Pinky's matched, which
   *   is the sort of half-fix that survives review because "the bug test
   *   passes".
   * LOAD-BEARING: yes — the stub returns {col: 0, row: 0}.
   */
  it('inherits the up-overflow in its pivot: facing up, the pivot is two up and two left', () => {
    const target = inkyTarget(
      INKY,
      context({ col: 12, row: 14 }, Direction.Up, { col: 14, row: 16 }),
    );

    expect(target).toEqual({ col: 6, row: 8 });
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: a boundary case of one pure function. Cheap here; through
   *   the pipeline it is a rare emergent situation nobody can reliably set up.
   * MEASURES: two configurations whose doubled vector lands off the 28x31
   *   board, one past the top-left and one past the bottom-right, each returned
   *   as-is rather than clamped:
   *     pac (2,3) facing left, blinky (20,20)  -> pivot (0,3)   -> (-20, -14)
   *     pac (24,27) facing right, blinky (2,2) -> pivot (26,27) -> (50, 52)
   * ORACLE: docs/ARCADE-REFERENCE.md — the original does not clamp ghost
   *   targets. An unreachable target is legal: the ghost simply steers toward
   *   it, which is exactly what the four scatter corners rely on too.
   * CATCHES: someone adding a clamp "for safety". Inky's off-board targets get
   *   pinned to a board edge, he starts behaving like a scattering ghost in the
   *   middle of a chase, and the bug is invisible until you watch him for a
   *   minute.
   * LOAD-BEARING: yes — the stub returns {col: 0, row: 0}, which is on the
   *   board and therefore wrong for both configurations.
   */
  it('returns an off-board target unclamped, because the arcade never clamps one', () => {
    expect(
      inkyTarget(INKY, context({ col: 2, row: 3 }, Direction.Left, { col: 20, row: 20 })),
    ).toEqual({ col: -20, row: -14 });

    expect(
      inkyTarget(INKY, context({ col: 24, row: 27 }, Direction.Right, { col: 2, row: 2 })),
    ).toEqual({ col: 50, row: 52 });
  });
});
