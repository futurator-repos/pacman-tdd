import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { squaredDistance } from './tile-distance.ts';
import { type Tile } from './tile.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * Ghost AI is, underneath the personalities, one repeated question: of the
 * tiles I could move to, which is nearest my target? The arcade answers it
 * with SQUARED distance and never takes a square root — partly because the
 * hardware had no square root worth using, and partly because it does not need
 * one: for comparing two distances, squaring preserves the order.
 *
 * Keeping the squaring is not nostalgia. It keeps every comparison in exact
 * integers, so two genuinely equal distances are equal to the bit and the
 * up/left/down/right tie-break stays deterministic — which is what makes a
 * replay reproduce a game exactly. It also keeps Clyde's boundary readable:
 * his rule is "eight tiles", and eight tiles squared is the literal 64 the
 * comparison is written against.
 */

describe('squaredDistance', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: one exact arithmetic result on a triangle chosen so the
   *   answer is unmistakable. Nothing to integrate and nothing to generate.
   * MEASURES: that the result is dx*dx + dy*dy in tile units — the 3-4-5
   *   triangle gives 9 + 16 = 25 — and that it is symmetric in its arguments.
   * ORACLE: Pythagoras, applied to the arcade's tile grid: a tile 3 columns
   *   and 4 rows away is at squared distance 25 (its true distance, 5 tiles,
   *   is what the arcade deliberately does NOT compute).
   * CATCHES: adding the absolute differences instead of squaring them
   *   (Manhattan distance, which gives 7 here). Ghosts would prefer different
   *   tiles at roughly half of all junctions and every ghost's path would be
   *   subtly wrong — the kind of bug that is obvious in a diff and invisible
   *   on screen.
   * LOAD-BEARING: yes — the stub returns 0.
   */
  it('is the sum of the squared column and row differences, in either argument order', () => {
    const a: Tile = { col: 10, row: 10 };
    const b: Tile = { col: 13, row: 14 };

    expect(squaredDistance(a, b)).toBe(25);
    expect(squaredDistance(b, a)).toBe(25);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: the claim "never takes a square root" is not observable by
   *   spying on Math.sqrt — that would test the implementation rather than the
   *   behaviour. It IS observable in the returned value: a real distance of
   *   sqrt(5) is irrational, so an implementation that rooted it could not
   *   return the exact integer 5.
   * MEASURES: that the answer for a 1-by-2 step is exactly the integer 5, not
   *   2.23606797749979.
   * ORACLE: arcade behaviour (docs/ARCADE-REFERENCE.md) — ghost target
   *   selection compares squared distances; the original hardware never
   *   computes a square root. 1*1 + 2*2 = 5.
   * CATCHES: someone "improving" this into a real distance function. Every
   *   comparison becomes a float comparison, exact ties stop being exactly
   *   equal, and ghost tie-breaks — hence replays — become unstable in a way
   *   that reproduces once in a thousand runs.
   * LOAD-BEARING: yes — the stub returns 0, which is an integer but not 5.
   */
  it('returns an exact integer even when the true distance is irrational', () => {
    const distance = squaredDistance({ col: 0, row: 0 }, { col: 1, row: 2 });

    expect(distance).toBe(5);
    expect(Number.isInteger(distance)).toBe(true);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: three exact points either side of one boundary — the
   *   cheapest complete statement of a threshold rule.
   * MEASURES: the value at Clyde's boundary and immediately either side of it:
   *   7 tiles is 49, 8 tiles is exactly 64, 9 tiles is 81.
   * ORACLE: arcade behaviour (docs/ARCADE-REFERENCE.md) — Clyde chases
   *   Pac-Man while further than eight tiles away and retreats to his scatter
   *   corner at eight tiles and closer. The comparison is made squared, so the
   *   literal boundary is 8*8 = 64.
   * CATCHES: the boundary drifting because the distance function scales
   *   differently — for instance measuring in pixels (8 tiles would read 4096)
   *   or halving the squares. Clyde's `> 64` test would then be true always or
   *   never, and the one thing that distinguishes him from Blinky disappears.
   * LOAD-BEARING: yes — the stub returns 0 for all three.
   */
  it("makes eight tiles exactly 64, the literal boundary in Clyde's rule", () => {
    const clyde: Tile = { col: 10, row: 20 };

    expect(squaredDistance(clyde, { col: 17, row: 20 })).toBe(49);
    expect(squaredDistance(clyde, { col: 18, row: 20 })).toBe(64);
    expect(squaredDistance(clyde, { col: 19, row: 20 })).toBe(81);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: the ghost tie-break is a claim about two results being
   *   EXACTLY equal, which one direct comparison states completely.
   * MEASURES: that two tiles genuinely equidistant from a target produce
   *   identical values — and that those values are the right ones.
   * ORACLE: Pythagoras again: from (10,10), the tile (13,14) is 3 across and 4
   *   down and the tile (6,7) is 4 across and 3 up. Both are 25.
   * CATCHES: any implementation that makes equal distances merely
   *   approximately equal (see the square-root test above). The arcade
   *   resolves an exact tie by direction order — up, then left, then down,
   *   then right — and a tie that is 25 versus 25.000000000000004 resolves by
   *   accident instead.
   * LOAD-BEARING: yes, BUT only because of the two toBe(25) assertions. An
   *   earlier draft asserted just `expect(up).toBe(left)`, which PASSES
   *   against a stub returning 0 for everything — a test that looks like it
   *   pins the tie-break and pins nothing at all. Worth reading twice: it is
   *   the commonest way a test quietly becomes worthless.
   */
  it('gives two equidistant tiles exactly the same value, which is what makes the tie-break deterministic', () => {
    const target: Tile = { col: 10, row: 10 };
    const oneWay = squaredDistance({ col: 13, row: 14 }, target);
    const otherWay = squaredDistance({ col: 6, row: 7 }, target);

    expect(oneWay).toBe(25);
    expect(otherWay).toBe(25);
    expect(oneWay).toBe(otherWay);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: two exact values covering the degenerate case and a
   *   neighbouring one. A property test for "non-negative" would pass against
   *   a function that always returned zero, which is precisely the trap below.
   * MEASURES: that a tile is at distance 0 from itself, and that a DIFFERENT
   *   tile is not.
   * ORACLE: Pythagoras: dx and dy are both 0 for the same tile, and an
   *   adjacent tile is 1.
   * CATCHES: a ghost standing on its own target reading as "not yet arrived",
   *   or — far worse — a distance function that collapses everything to zero,
   *   which would make every junction a four-way tie and send every ghost
   *   permanently upward.
   * LOAD-BEARING: yes — the stub passes the first assertion and fails the
   *   second, which is the only reason the second is here.
   */
  it('is zero for a tile and itself, and greater than zero for any other tile', () => {
    const tile: Tile = { col: 4, row: 7 };

    expect(squaredDistance(tile, tile)).toBe(0);
    expect(squaredDistance(tile, { col: 4, row: 8 })).toBe(1);
  });

  /**
   * TYPE: property
   * WHY THIS TYPE: this is the invariant the whole "squared, never rooted"
   *   decision rests on — that squaring preserves ORDER, so comparing squared
   *   distances ranks tiles exactly as comparing real distances would. One
   *   example would not state it; fast-check states it across the width of the
   *   board and shrinks any failure to the smallest gap.
   * MEASURES: that stepping one tile closer to a target along a row strictly
   *   decreases the squared distance, for every gap from 1 to 27 tiles.
   * ORACLE: monotonicity of x -> x*x on non-negative integers, which is the
   *   mathematical fact that licenses the arcade's shortcut. 27 is the widest
   *   gap possible on a 28-column board.
   * CATCHES: any non-monotonic distance — a wrapped or clamped one, or a
   *   modulo creeping in for the tunnel. A ghost would then read a step
   *   towards its target as a step away and oscillate at a junction forever.
   * LOAD-BEARING: yes — the stub returns 0 for both, and 0 is not greater
   *   than 0.
   */
  it('strictly decreases as a ghost steps one tile closer to its target', () => {
    const target: Tile = { col: 0, row: 0 };

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 27 }), (gap) => {
        const further = squaredDistance({ col: gap, row: 0 }, target);
        const nearer = squaredDistance({ col: gap - 1, row: 0 }, target);
        expect(further).toBeGreaterThan(nearer);
      }),
    );
  });

  /**
   * TYPE: property
   * WHY THIS TYPE: symmetry must hold for every pair, not for the one pair
   *   asserted in the first test. Cheap to state, and fast-check covers
   *   negative columns and rows — which occur for real, because Inky's target
   *   is deliberately left unclamped and can land off the board.
   * MEASURES: squaredDistance(a, b) === squaredDistance(b, a) for arbitrary
   *   tiles, on and off the grid.
   * ORACLE: the definition of distance — it is a metric, and a metric is
   *   symmetric. Not a fact about our code.
   * CATCHES: an implementation that subtracts in one fixed order and forgets
   *   the second square, so distances become negative in one direction.
   * LOAD-BEARING: NO — predicted to PASS against the do-nothing stub, because
   *   0 === 0 is symmetric. It is kept deliberately, as a GUARD rather than a
   *   specification, and labelled so: it constrains every future
   *   implementation without pinning today's behaviour. docs/TDD-FINDINGS.md
   *   calls this the (c) case — genuinely true of all correct
   *   implementations — and the point of predicting it in advance is that an
   *   UNEXPECTED pass is the thing worth investigating.
   */
  it('is symmetric for any pair of tiles, on or off the board', () => {
    const anyTile = fc.record({
      col: fc.integer({ min: -20, max: 47 }),
      row: fc.integer({ min: -20, max: 50 }),
    });

    fc.assert(
      fc.property(anyTile, anyTile, (a, b) => {
        expect(squaredDistance(a, b)).toBe(squaredDistance(b, a));
      }),
    );
  });
});
