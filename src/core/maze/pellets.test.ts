import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { type Tile } from '../geometry/tile.ts';
import { tinyMaze } from '../testing/tiny-maze.ts';

import { ARCADE_MAZE } from './arcade-maze.ts';
import { type Maze } from './maze.ts';
import {
  type PelletField,
  PelletKind,
  createPelletField,
  eatAt,
  isCleared,
  pelletAt,
  remaining,
} from './pellets.ts';

/**
 * The food on the board.
 *
 * ORACLE FOR THE WHOLE FILE. docs/ARCADE-REFERENCE.md section 8.1: every level
 * of the original carries **240 dots and 4 energizers — 244 edible tiles** —
 * and the level ends when all 244 are gone. Nothing in this file takes an
 * expected value from the implementation; the counts come from that section and
 * from an eleven-character fixture a reader can count by eye.
 *
 * WHY IMMUTABILITY IS THE POINT OF THIS FILE. `PelletField` sits inside
 * `GameState`, and docs/ARCHITECTURE.md's whole replay story rests on a state
 * value never being edited in place. An `eatAt` that called `Set.delete` would
 * pass a careless test, then make every OTHER test lie: a test holding a
 * "before" value would silently be comparing that value with itself. So the
 * immutability test below asserts the returned field AND the original field,
 * after the call, and it is the most important test here.
 */

/**
 * Nine columns by five rows, with five dots, one energizer and one bare tile.
 *
 * A hand-drawn board rather than the 28x31 arcade one, because a failure should
 * print a situation a reader can check by counting characters:
 *
 * ```
 *      col 012345678
 * row 0    #########
 * row 1    ####H####
 * row 2    ####-####
 * row 3    #.o.P...#     . = dot   o = energizer   P = Pac-Man's spawn
 * row 4    #########
 * ```
 *
 * `H` and `-` are there because `parseMaze` requires a ghost house and a gate;
 * they carry no food and take no part in any assertion. The dots are at
 * (1,3), (3,3), (5,3), (6,3), (7,3); the energizer is at (2,3); (4,3) is
 * Pac-Man's spawn and holds nothing. Five plus one is six.
 */
function foodMaze(): Maze {
  return tinyMaze(['#########', '####H####', '####-####', '#.o.P...#', '#########']);
}

/** The energizer tile of `foodMaze`. */
const ENERGIZER: Tile = { col: 2, row: 3 };
/**
 * The leftmost dot, named rather than indexed out of `DOTS`.
 *
 * Under `noUncheckedIndexedAccess` an array index is `Tile | undefined`, and
 * the tempting repairs are both defects: `DOTS[0]!` is banned outright, and
 * `DOTS[0] ?? somethingElse` would quietly test a DIFFERENT tile if the array
 * were ever emptied. A named constant has no missing case to paper over.
 */
const FIRST_DOT: Tile = { col: 1, row: 3 };
/** The five dot tiles of `foodMaze`, left to right. */
const DOTS: readonly Tile[] = [
  FIRST_DOT,
  { col: 3, row: 3 },
  { col: 5, row: 3 },
  { col: 6, row: 3 },
  { col: 7, row: 3 },
];
/** Pac-Man's spawn in `foodMaze` — open floor with nothing on it. */
const BARE_TILE: Tile = { col: 4, row: 3 };

/**
 * Eat a list of tiles in order, with NO assertion inside the loop.
 *
 * Deliberate, and worth reading if you are new to this: an assertion inside a
 * loop passes vacuously when the loop body never runs, which is the exact
 * defect docs/TDD-FINDINGS.md records finding three of. The house rule is
 * `expect.assertions(n)` around such a loop; keeping the loop assertion-free
 * removes the hazard instead of policing it, and the test then asserts once, on
 * the value the fold produced.
 */
function eatAll(field: PelletField, tiles: readonly Tile[]): PelletField {
  let eaten = field;
  for (const tile of tiles) {
    eaten = eatAt(eaten, tile);
  }
  return eaten;
}

describe('createPelletField', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One construction and three assertions over the real board.
   *   It is the only test in the file that uses ARCADE_MAZE, and it uses it on
   *   purpose: because the counts are READ OFF the maze rather than written
   *   into this module, this test also demonstrates that a PelletField is
   *   derived from the board instead of hard-coded. Nothing here needs a system
   *   or a frame, so nothing more expensive than a unit is warranted.
   * MEASURES: remaining() and eaten at construction, and that a full board does
   *   not report itself cleared.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.1 — 240 dots plus 4 energizers,
   *   244 in total, on every level of the original.
   * CATCHES: A field built from `pelletTiles` alone, giving 240. The board then
   *   reports itself cleared while four energizers are still blinking on
   *   screen, the level advances early, and the last fright of every level —
   *   and the ghost points that go with it — is silently unreachable.
   * LOAD-BEARING: yes (the stub's remaining() is 0, not 244).
   */
  it('carries the 240 dots and 4 energizers of the arcade board, 244 in all, and is not cleared', () => {
    const field = createPelletField(ARCADE_MAZE);

    expect(remaining(field)).toBe(244);
    expect(field.eaten).toBe(0);
    expect(isCleared(field)).toBe(false);
  });
});

describe('eatAt', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: The assertion has to check BOTH the returned value and the
   *   ORIGINAL value after the call, which only an example test states clearly.
   *   A property test could state "eatAt does not mutate" but would say it in a
   *   way a learner cannot read; this shape shows the two fields side by side.
   * MEASURES: That eatAt returns a different object, that the new field has one
   *   fewer pellet and one more eaten, and that the field passed IN is
   *   unchanged when the call returns.
   * ORACLE: docs/ARCHITECTURE.md's stated invariant — GameState and everything
   *   reachable from it is immutable, which is what makes a replay reproduce
   *   and a failed assertion diffable. The counts (6 before, 5 after) come from
   *   the six food tiles drawn in the fixture above.
   * CATCHES: An in-place `Set.delete`. Replays would diverge from live play,
   *   and any test holding a "before" state would silently be comparing that
   *   state with itself — one mutation that makes many other tests lie.
   * LOAD-BEARING: yes (the stub returns its input, so remaining() is 0 and the
   *   returned field is the same object).
   */
  it('returns a new field with one fewer dot and leaves the original untouched', () => {
    const before = createPelletField(foodMaze());
    const after = eatAt(before, FIRST_DOT);

    expect(after).not.toBe(before);
    expect(remaining(after)).toBe(5);
    expect(after.eaten).toBe(1);
    expect(pelletAt(after, FIRST_DOT)).toBe(PelletKind.None);

    /* The original, AFTER the call. This is the half that catches mutation. */
    expect(remaining(before)).toBe(6);
    expect(before.eaten).toBe(0);
    expect(pelletAt(before, FIRST_DOT)).toBe(PelletKind.Pellet);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Unit, and worth naming honestly as a guard: an eatAt that
   *   simply returned its argument passes this and fails the test above it. It
   *   earns its place because callers deliberately eat WITHOUT checking first —
   *   Pac-Man's tile is offered to eatAt on every frame he enters one — so
   *   "no-op on an empty tile" is published contract rather than an accident.
   *   Reference identity is asserted rather than deep equality because that is
   *   the stronger promise and the cheaper one for a caller to rely on.
   * MEASURES: Idempotence of eatAt on a tile that never held food, and on a
   *   tile whose food has already been taken.
   * ORACLE: The stated contract in `pellets.ts` — callers need no guard before
   *   eating, so eatAt must return the very same value when there is nothing
   *   there.
   * CATCHES: The eaten counter incrementing on empty tiles. Pac-Man occupies
   *   one tile for eight frames at level-1 speed, so the counter would climb by
   *   eight per tile: the fruit appears within seconds, Cruise Elroy engages on
   *   a nearly full board, and the ghost house empties immediately.
   * LOAD-BEARING: no — a guard. The do-nothing stub returns its input, which is
   *   exactly what this test asks for. Read it together with the test above.
   */
  it('returns the very same field for a bare tile and for a tile eaten already', () => {
    const field = createPelletField(foodMaze());

    expect(eatAt(field, BARE_TILE)).toBe(field);

    const once = eatAt(field, FIRST_DOT);
    expect(eatAt(once, FIRST_DOT)).toBe(once);
  });
});

describe('pelletAt', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Four cases, one function, no dependencies. This
   *   classification is the caller's ENTIRE basis for 10 points versus 50, one
   *   freeze frame versus three, and fright versus no fright, so it is asserted
   *   directly rather than inferred through the eat rule.
   * MEASURES: The three-way classification, plus the out-of-bounds column.
   * ORACLE: Arcade rule (docs/ARCADE-REFERENCE.md sections 8.1 and 8.2): dots
   *   and energizers are different objects with different effects. The
   *   out-of-bounds expectations come from `maze.ts`'s documented reason for
   *   guarding the column in kindAt, and BOTH SIDES are asserted because the
   *   tunnel has two mouths. With a flat row-major array, column -2 of row 4 is
   *   index 4*9-2 = 34, which in this fixture is the dot at (7,3); column 10 of
   *   row 2 is index 2*9+10 = 28, which is the dot at (1,3). Both are legal
   *   places to stand — an actor part-way through the tunnel really does have a
   *   column below zero at one end and past the last column at the other.
   * CATCHES: Energizers classified as plain dots, so fright never starts and
   *   the game is unplayable past the first ghost encounter — or a missing
   *   column guard, which makes an actor in the tunnel eat a dot from a
   *   neighbouring row, one phantom dot per transit, until the board clears
   *   itself. Asserting only the negative column would leave a guard written as
   *   `col < 0` looking correct while the right-hand mouth stayed broken.
   * LOAD-BEARING: yes (the stub answers None to everything, so the energizer
   *   and dot assertions fail).
   */
  it('tells an energizer from a dot from bare floor, and guards the column like kindAt', () => {
    const field = createPelletField(foodMaze());

    expect(pelletAt(field, ENERGIZER)).toBe(PelletKind.PowerPellet);
    expect(pelletAt(field, FIRST_DOT)).toBe(PelletKind.Pellet);
    expect(pelletAt(field, BARE_TILE)).toBe(PelletKind.None);
    expect(pelletAt(field, { col: 0, row: 3 })).toBe(PelletKind.None);
    expect(pelletAt(field, { col: -2, row: 4 })).toBe(PelletKind.None);
    expect(pelletAt(field, { col: 10, row: 2 })).toBe(PelletKind.None);
  });
});

describe('isCleared', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Built directly into the deliberately awkward state — every
   *   dot gone, one energizer left. On the real board that state is 240 eaten
   *   with one energizer remaining: nearly impossible to reach by playing, and
   *   trivial to construct by hand on a six-tile fixture. It is precisely the
   *   case an implementation that checks a single set gets wrong.
   * MEASURES: isCleared and remaining() evaluated across BOTH sets, on either
   *   side of the last energizer.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.1 — the level advances when all
   *   244 dots have been eaten, dots AND energizers.
   * CATCHES: The level ending with an energizer still on the board. The player
   *   loses the last fright of the level and every ghost it was worth, and on
   *   the real board the four corner energizers would simply never be eatable.
   * LOAD-BEARING: yes (the stub's remaining() is 0 and isCleared() is false, so
   *   both the "one left" count and the final "cleared" assertion fail).
   */
  it('is false while one energizer remains and true only once it is gone too', () => {
    const field = createPelletField(foodMaze());

    const dotsGone = eatAll(field, DOTS);
    expect(remaining(dotsGone)).toBe(1);
    expect(dotsGone.eaten).toBe(5);
    expect(isCleared(dotsGone)).toBe(false);

    const allGone = eatAt(dotsGone, ENERGIZER);
    expect(remaining(allGone)).toBe(0);
    expect(allGone.eaten).toBe(6);
    expect(isCleared(allGone)).toBe(true);
  });

  /*
   * TYPE: property
   * WHY THIS TYPE: The claim is about EVERY order of eating, and a player
   *   supplies an arbitrary one. Enumerating orders by hand is impossible and
   *   picking three is arbitrary; fast-check generates permutations of the real
   *   244 tiles and shrinks any counterexample to a minimal reproduction. It is
   *   still pure arithmetic over sets, so it costs milliseconds.
   * MEASURES: That folding eatAt over a permutation of all 244 food tiles ends
   *   with remaining() 0, eaten 244 and isCleared() true — order-independently.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.1: a level holds exactly 244
   *   edible tiles and is finished when they are gone. The 244 is asserted
   *   here, not read from the field.
   * CATCHES: An eaten counter that double-counts or skips under some orders —
   *   for instance an implementation that removes from the dot set and
   *   increments regardless, which is correct for every order that takes the
   *   energizers last and wrong for the orders a real player produces.
   * LOAD-BEARING: yes (the stub never removes anything, so eaten stays 0 and
   *   isCleared stays false).
   */
  it('clears the arcade board and reports exactly 244 eaten, whatever the order', () => {
    const allFood: Tile[] = [...ARCADE_MAZE.pelletTiles, ...ARCADE_MAZE.powerPelletTiles];
    expect(allFood).toHaveLength(244);

    fc.assert(
      fc.property(
        fc.shuffledSubarray(allFood, { minLength: 244, maxLength: 244 }),
        (order: readonly Tile[]) => {
          const cleared = eatAll(createPelletField(ARCADE_MAZE), order);

          expect(remaining(cleared)).toBe(0);
          expect(cleared.eaten).toBe(244);
          expect(isCleared(cleared)).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });
});
