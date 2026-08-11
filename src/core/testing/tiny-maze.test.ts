import { describe, expect, it } from 'vitest';

import { ALL_DIRECTIONS, Direction } from '../geometry/direction.ts';
import { walkableNeighbours } from '../maze/maze.ts';

import { corridorMaze, crossroadsMaze, deadEndMaze } from './tiny-maze.ts';

/**
 * The hand-drawn fixtures every later slice borrows.
 *
 * `src/core/testing/` is production code, not a test helper hiding in `src/`,
 * and it is held to the same 100% bar as the rules — because a fixture that
 * shapes twenty other tests deserves to be correct. These tests are what make
 * that claim true rather than stated.
 *
 * Each test below is really asking one question: is this fixture the SHAPE its
 * name promises? A "crossroads" that quietly became a T-junction would still
 * parse, still pass every maze test, and would silently change the answer of
 * every ghost tie-break test built on top of it.
 */
describe('the tiny maze fixtures', () => {
  /*
   * TYPE: smoke
   * WHY THIS TYPE: A smoke check on the fixtures themselves — the cheapest
   *   possible "is it standing up at all". It earns its place by LOCALISING
   *   failure: without it, a fixture that rots (an edit that adds a corridor and
   *   accidentally deletes the ghost-house gate) fails twenty movement tests in
   *   three other slices with messages about the parser, instead of failing
   *   this one with a message about the fixture.
   * MEASURES: That the corridor, crossroads and dead-end layouts satisfy
   *   parseMaze's validation — a legend it recognises, rows of equal width, a
   *   gate and a Pac-Man spawn.
   * ORACLE: parseMaze's own documented contract in parse-maze.ts, which a
   *   fixture must satisfy to be usable as a maze at all.
   * CATCHES: A fixture edited without re-reading the parser's requirements. The
   *   symptom otherwise appears three slices away, in someone else's test.
   * LOAD-BEARING: NO — a guard by construction. "Does not throw" is all it
   *   asks, and the stub throws nothing. It is listed as a guard in
   *   docs/TEST-PLAN.md for exactly this reason. The three tests below are what
   *   actually specify the fixtures.
   */
  it('each parses as a legal maze', () => {
    expect.assertions(3);
    for (const build of [corridorMaze, crossroadsMaze, deadEndMaze]) {
      expect(build).not.toThrow();
    }
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: One query against one fixture. A five-row board is small
   *   enough that a reader can confirm the expected answer by looking at the
   *   ASCII in tiny-maze.ts, which is the entire point of a hand-drawn fixture.
   * MEASURES: That the corridor is a corridor — an interior tile has exactly
   *   two exits, and they are the two horizontal ones.
   * ORACLE: The layout drawn in tiny-maze.ts's doc comment: row 3 is
   *   `#...P.....#`, so (5,3) has open floor at (4,3) and (6,3) and solid wall
   *   above and below. The ORDER, left before right, comes from ALL_DIRECTIONS.
   * CATCHES: A stray gap typed into the wall above the corridor. Slice s03's
   *   "an actor walking into a wall stops flush at the tile centre" test would
   *   then be exercising a T-junction and quietly stop testing what it says.
   * LOAD-BEARING: yes — the stub returns no neighbours at all.
   */
  it('the corridor gives an interior tile exactly two exits, left and right', () => {
    expect(walkableNeighbours(corridorMaze(), { col: 5, row: 3 }, false)).toEqual([
      { direction: Direction.Left, tile: { col: 4, row: 3 } },
      { direction: Direction.Right, tile: { col: 6, row: 3 } },
    ]);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Same cost, same fixture style. This one asserts the FULL
   *   ordered set of directions against ALL_DIRECTIONS, which is what makes the
   *   fixture usable for tie-break tests: with every direction legal, a ghost's
   *   answer is entirely about the rule and not about the walls.
   * MEASURES: That (5,4) really is a four-way junction.
   * ORACLE: The layout drawn in tiny-maze.ts: `#....P....#` on row 4 with
   *   `#####.#####` above and below, so all four neighbours of (5,4) are open.
   * CATCHES: The junction silently degrading to a T. Slice s06's "when two
   *   candidates are exactly equidistant, up beats left beats down beats right"
   *   would then have only three candidates to choose between, and the missing
   *   fourth is the one a reader would assume was covered.
   * LOAD-BEARING: yes.
   */
  it('the crossroads gives its junction all four exits', () => {
    const exits = walkableNeighbours(crossroadsMaze(), { col: 5, row: 4 }, false);

    expect(exits.map((exit) => exit.direction)).toEqual(ALL_DIRECTIONS);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: One query, one expected element. The dead end exists to
   *   force a single awkward case, so the test that pins it should be exactly
   *   as small as the case is.
   * MEASURES: That (5,3) has precisely one exit, and that it is the way the
   *   actor came in.
   * ORACLE: The layout drawn in tiny-maze.ts: row 3 is `#...P.#####`, so (5,3)
   *   is walled on three sides.
   * CATCHES: The dead end quietly becoming a corridor. Slice s06's "in a dead
   *   end where the reversal is the only option, the reversal is taken rather
   *   than throwing" would then never reach the branch it was written for — the
   *   test would pass forever while the crash it guards against stays live.
   * LOAD-BEARING: yes.
   */
  it('the dead end leaves only the way back', () => {
    expect(walkableNeighbours(deadEndMaze(), { col: 5, row: 3 }, false)).toEqual([
      { direction: Direction.Left, tile: { col: 4, row: 3 } },
    ]);
  });
});
