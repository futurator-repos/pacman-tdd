import { describe, expect, it } from 'vitest';

import { Direction } from '../geometry/direction.ts';

import { type Actor, SUBPIXELS_PER_PIXEL, isAtTileCentre, tileOf } from './actor.ts';

/**
 * The Actor record and the two questions every mover asks about itself:
 * "which tile am I on?" and "am I standing on its centre?".
 *
 * Both answers are pure arithmetic on a whole-pixel position, which is why
 * they live here rather than in the maze: an actor knows where it is without
 * knowing what is around it.
 *
 * UNITS FOR THE WHOLE FILE. The arcade board is a 28x31 grid of 8x8 pixel
 * tiles (docs/ARCADE-REFERENCE.md, restated in docs/ARCHITECTURE.md's decision
 * to keep core in true arcade units). So tile (col, row) covers pixels
 * x in [col*8, col*8+7] and its centre pixel is (col*8 + 4, row*8 + 4). Those
 * two formulas are the source of every expected number below; the literals are
 * written out rather than imported so that a bug in TILE_SIZE cannot quietly
 * agree with itself.
 */
describe('Actor', () => {
  /** An actor parked at a pixel, facing right, with nothing queued. */
  function actorAt(x: number, y: number): Actor {
    return {
      position: { x, y },
      facing: Direction.Right,
      queued: null,
      carrySubPixels: 0,
    };
  }

  /*
   * TYPE: unit
   * WHY THIS TYPE: One constant. Asserted on its own because it is the
   *   denominator of every movement calculation in the game, and because the
   *   number chosen is not arbitrary.
   * MEASURES: That a pixel is divided into 256 sub-pixels.
   * ORACLE: docs/ARCHITECTURE.md: "sub-pixel integer carry (256 sub-pixels per
   *   pixel) so movement is exact integer arithmetic and a test asserts toBe,
   *   never toBeCloseTo". 256 is a whole power of two, so the division into
   *   whole pixels plus a remainder is exact in any integer representation.
   * CATCHES: Somebody switching to 100 sub-pixels "because percentages are
   *   easier". Every arcade speed fraction then rounds to a two-decimal grid,
   *   the ghost/Pac-Man phase relationship the original depends on shifts, and
   *   nothing else in the suite would notice.
   * LOAD-BEARING: yes
   */
  it('divides each pixel into 256 sub-pixels', () => {
    expect(SUBPIXELS_PER_PIXEL).toBe(256);
  });

  describe('tileOf', () => {
    /*
     * TYPE: unit
     * WHY THIS TYPE: One exact conversion in each of two interesting places —
     *   an ordinary tile centre, and the negative side of zero. Both are pure
     *   arithmetic, so there is nothing to integrate and nothing to generate.
     * MEASURES: That a whole-pixel position maps to the tile containing it,
     *   using floor rather than truncation.
     * ORACLE: The 8x8 tile grid of docs/ARCADE-REFERENCE.md: pixel (20, 28)
     *   lies in column 20/8 = 2 and row 28/8 = 3. Pixel x = -1 lies one pixel
     *   to the LEFT of column 0, which is column -1; truncation would fold it
     *   back onto column 0.
     * CATCHES: Math.trunc instead of Math.floor. An actor a single pixel out of
     *   the left tunnel mouth reads as column 0 — a wall — so it is reported
     *   blocked and the tunnel never wraps: the classic "Pac-Man sticks in the
     *   tunnel" bug, and it only ever reproduces on one side of the board.
     * LOAD-BEARING: yes
     */
    it('maps a pixel to the tile containing it, flooring across zero', () => {
      expect(tileOf(actorAt(20, 28))).toEqual({ col: 2, row: 3 });
      expect(tileOf(actorAt(-1, 12))).toEqual({ col: -1, row: 1 });
    });
  });

  describe('isAtTileCentre', () => {
    /*
     * TYPE: unit
     * WHY THIS TYPE: Three positions around one boundary, asserted exactly.
     *   A "close to the centre" tolerance would be a DIFFERENT behaviour, so
     *   exactness is the thing under test and only exact values can state it.
     * MEASURES: The predicate every turn decision in the game is gated on:
     *   true on the centre pixel, false one pixel either side of it, on both
     *   axes.
     * ORACLE: Arcade rule: an actor takes its direction decisions at tile
     *   centres, at one specific pixel — (col*8 + 4, row*8 + 4). For tile
     *   (2, 3) that is (20, 28); (19, 28) and (20, 27) are one pixel short of
     *   it on each axis.
     * CATCHES: A centre test with a plus-or-minus-one tolerance. A ghost then
     *   evaluates its turn on three consecutive pixels, can pick a different
     *   direction on each, and reverses into itself at a junction — a defect
     *   that looks like "the ghosts jitter" and has no other failing test.
     * LOAD-BEARING: yes
     */
    it('is true only on the exact centre pixel of the tile', () => {
      expect(isAtTileCentre(actorAt(20, 28))).toBe(true);
      expect(isAtTileCentre(actorAt(19, 28))).toBe(false);
      expect(isAtTileCentre(actorAt(21, 28))).toBe(false);
      expect(isAtTileCentre(actorAt(20, 27))).toBe(false);
      expect(isAtTileCentre(actorAt(20, 29))).toBe(false);
    });

    /*
     * TYPE: unit
     * WHY THIS TYPE: One position, one assertion. Kept apart from the test
     *   above because it states a different fact: the centre is a property of
     *   the position alone, so it must hold on any tile, not just the one
     *   picked above — including a tile far from the origin, where an
     *   implementation that compared against a hard-coded 4 would still pass.
     * MEASURES: The centre predicate on the far side of the board.
     * ORACLE: Same rule at tile (27, 30), the bottom-right tile of the 28x31
     *   board: centre pixel (27*8 + 4, 30*8 + 4) = (220, 244).
     * CATCHES: A predicate written as `position.x === 4 && position.y === 4`,
     *   which is true only in the top-left tile. Every actor in the rest of the
     *   maze would then be permanently unable to turn.
     * LOAD-BEARING: yes
     */
    it('is true on the centre of a tile far from the origin', () => {
      expect(isAtTileCentre(actorAt(220, 244))).toBe(true);
    });
  });
});
