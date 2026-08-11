import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ALL_DIRECTIONS, Direction } from './direction.ts';
import { centreOf, neighbour, TILE_SIZE, type Tile, tileAt, tileEquals } from './tile.ts';
import { type Vector2 } from './vector.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * Everything in the game happens in one of two coordinate spaces. The maze is
 * a grid of tiles; actors live at whole pixels. Pellets, collisions, ghost
 * targeting and wall lookups are all tile questions; movement, drawing and
 * cornering are all pixel questions. This file is the only place the two
 * spaces meet, so a mistake here is a mistake everywhere.
 *
 * The board is 28 columns by 31 rows of 8x8 pixel tiles — the arcade's own
 * numbers, cited in docs/ARCADE-REFERENCE.md — which is why core works in
 * true arcade units: the published speed, wave and fright tables then drop in
 * unmodified, with no conversion factor to get wrong.
 */

/* The arcade board's dimensions. Written as literals rather than imported
   from src/core/maze/ because that module belongs to a later slice — and
   because a test that shows its own numbers is easier to check than one that
   imports them from the thing it is testing. */
const MAZE_COLUMNS = 28;
const MAZE_ROWS = 31;

describe('TILE_SIZE and centreOf', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: a constant and one exact conversion, asserted together
   *   because the +4 offset is only meaningful in terms of the 8. This is
   *   exact integer arithmetic on one value; a property test here could only
   *   restate the formula the implementation uses, which is the definition of
   *   a test with no oracle.
   * MEASURES: the one number that converts tiles to pixels everywhere in the
   *   game, and the half-tile offset that puts an actor in the middle of a
   *   corridor rather than against its wall.
   * ORACLE: docs/ARCADE-REFERENCE.md — the original board is a 28x31 grid of
   *   8x8 pixel tiles. centreOf follows arithmetically: col*8+4, row*8+4, so
   *   {col:2,row:3} is the pixel {x:20,y:28}.
   * CATCHES: TILE_SIZE copied as 16 from the actor sprites (every actor at
   *   double coordinates and the maze off-screen), or centreOf returning the
   *   tile's top-left corner, so isAtTileCentre is never true and no actor
   *   ever turns.
   * LOAD-BEARING: yes — the stub reports TILE_SIZE 0 and centre {x:0,y:0}.
   */
  it('TILE_SIZE is 8 arcade pixels and centreOf({col:2,row:3}) is the pixel {x:20,y:28}', () => {
    expect(TILE_SIZE).toBe(8);
    expect(centreOf({ col: 2, row: 3 })).toEqual({ x: 20, y: 28 });
    /* The origin tile too: half of 8 is 4, not 0 and not 8. */
    expect(centreOf({ col: 0, row: 0 })).toEqual({ x: 4, y: 4 });
  });
});

describe('tileAt', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: one boundary value on the negative side of zero. The
   *   cheapest possible test for the classic Math.trunc / Math.floor
   *   confusion, which has exactly one interesting input.
   * MEASURES: that pixel -> tile conversion is monotonic across zero.
   * ORACLE: stated design invariant (docs/ARCHITECTURE.md, s01) — tileAt must
   *   be total and monotonic so a position that has left the board through the
   *   tunnel reads as off-grid, and kindAt can then report Wall. Truncation
   *   collapses x=-1 and x=+1 into the same column; flooring does not. With
   *   TILE_SIZE 8, x=-1 is column -1 and x=-9 is column -2.
   * CATCHES: an actor stepping one pixel out of the left tunnel mouth reads as
   *   column 0 — a wall tile — so he is reported blocked and the tunnel never
   *   wraps.
   * LOAD-BEARING: yes — the stub answers {col:0,row:0} for every pixel.
   */
  it('floors rather than truncates, so a pixel at x=-1 is column -1 and not column 0', () => {
    expect(tileAt({ x: -1, y: -1 })).toEqual({ col: -1, row: -1 });
    expect(tileAt({ x: -8, y: -8 })).toEqual({ col: -1, row: -1 });
    expect(tileAt({ x: -9, y: -9 })).toEqual({ col: -2, row: -2 });
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: four exact boundary pixels. The interesting inputs are the
   *   last pixel of a tile and the first pixel of the next one; a property
   *   test would generate hundreds of uninteresting interior pixels to reach
   *   the same two edges.
   * MEASURES: that a whole 8-pixel run maps to one tile, and that the run
   *   starts at the tile's left/top edge rather than at its centre.
   * ORACLE: docs/ARCADE-REFERENCE.md — 8x8 tiles laid out from the playfield
   *   origin, so column c covers pixels 8c..8c+7 and the board's last tile is
   *   (27, 30), covering pixel (223, 247).
   * CATCHES: an off-by-one in the division — a tile boundary landing one pixel
   *   early would make an actor "enter" the next tile a pixel before he
   *   reaches it, eating pellets through walls at every junction.
   * LOAD-BEARING: yes — the stub answers {col:0,row:0} everywhere, so the 8
   *   and 223/247 cases fail.
   */
  it('maps every pixel of a tile to that tile, and the next pixel to the next tile', () => {
    expect(tileAt({ x: 0, y: 0 })).toEqual({ col: 0, row: 0 });
    expect(tileAt({ x: 7, y: 7 })).toEqual({ col: 0, row: 0 });
    expect(tileAt({ x: 8, y: 8 })).toEqual({ col: 1, row: 1 });
    /* The bottom-right tile of the arcade board: 27*8+7 = 223, 30*8+7 = 247. */
    expect(tileAt({ x: 223, y: 247 })).toEqual({ col: 27, row: 30 });
  });

  /**
   * TYPE: property
   * WHY THIS TYPE: tileAt and centreOf must be mutually consistent over the
   *   whole 28x31 grid, not at the three points a person would pick.
   *   fast-check explores the grid and shrinks any off-by-one to the smallest
   *   failing tile, which is what makes the failure readable.
   * MEASURES: the round trip tileAt(centreOf(t)) === t for every tile on the
   *   board.
   * ORACLE: stated invariant of the pair (docs/TEST-PLAN.md) — they are two
   *   halves of one coordinate mapping, so one must invert the other on tile
   *   centres. Note this is an invariant BETWEEN two functions, which is why
   *   it is not a tautology: an implementation is free to get either one
   *   wrong, and this catches the disagreement.
   * CATCHES: a +8 instead of +4 in centreOf, landing the actor on the boundary
   *   of the NEXT tile. Movement would look right in a corridor and break at
   *   every junction — the hardest class of bug to localise later.
   * LOAD-BEARING: yes — the stub's centreOf returns {x:0,y:0} and its tileAt
   *   returns {col:0,row:0}, so every tile except (0,0) fails, and fast-check
   *   shrinks the counterexample to {col:0,row:1}.
   */
  it('maps the centre pixel of any tile back to that same tile', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAZE_COLUMNS - 1 }),
        fc.integer({ min: 0, max: MAZE_ROWS - 1 }),
        (col, row) => {
          const tile: Tile = { col, row };
          expect(tileAt(centreOf(tile))).toEqual(tile);
        },
      ),
    );
  });
});

describe('tileEquals', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: one assertion on two distinct objects with equal fields.
   *   There is no cheaper form, and nothing to integrate.
   * MEASURES: that Tile behaves as a value type, which is what lets collision
   *   and targeting compare tiles at all.
   * ORACLE: stated design invariant (docs/ARCHITECTURE.md) — Tile is a plain
   *   readonly record with no identity, so equality must be structural. The
   *   two negative cases pin that BOTH fields are compared: a tileEquals that
   *   only looked at `col` would pass the positive case.
   * CATCHES: someone reaching for `a === b` later. Collision would never fire,
   *   because Pac-Man's tile object is never the same object as a ghost's.
   * LOAD-BEARING: yes — the stub returns false, so the positive case fails.
   *   (Note the negative cases PASS against the stub, which is exactly why
   *   they are not enough on their own.)
   */
  it('compares two tiles by value, not by reference', () => {
    const pacman: Tile = { col: 13, row: 23 };
    const blinky: Tile = { col: 13, row: 23 };

    /* Two separate objects. If this were the same object the test would prove
       nothing about structural equality. */
    expect(pacman).not.toBe(blinky);
    expect(tileEquals(pacman, blinky)).toBe(true);
    expect(tileEquals(pacman, { col: 13, row: 24 })).toBe(false);
    expect(tileEquals(pacman, { col: 14, row: 23 })).toBe(false);
  });
});

describe('Tile as a type', () => {
  /**
   * TYPE: unit (compile-time)
   * WHY THIS TYPE: the claim is about TYPES, so the assertion is made by tsc,
   *   not by vitest — `@ts-expect-error` fails the typecheck if the line it
   *   guards ever stops being an error. There is no runtime experiment that
   *   could observe this, and a slower test would observe it even less.
   * MEASURES: that Tile and Vector2 are mutually unassignable, so passing
   *   pixels where tiles are expected cannot compile.
   * ORACLE: docs/ARCHITECTURE.md — "the Tile type deliberately NOT being
   *   Vector2 so the classic tile/pixel mix-up is a compile error". Tiles are
   *   {col,row}; pixels are {x,y}; they differ by the factor of 8 above.
   * CATCHES: someone declaring `type Tile = Vector2` for convenience. Every
   *   tile/pixel confusion in the game — a ghost targeting pixel (13,23)
   *   instead of tile (13,23), 8x too close to the origin — would then compile
   *   silently.
   * LOAD-BEARING: no. It is a guard, and it is a guard of an unusual kind: it
   *   passes under vitest by construction, and fails only under
   *   `tsc --noEmit`. Run the typecheck to see it work; deleting the
   *   `@ts-expect-error` comments is what makes it fail today.
   */
  it('is not interchangeable with Vector2, so a tile/pixel mix-up is a compile error', () => {
    const tile: Tile = { col: 2, row: 3 };
    const pixel: Vector2 = { x: 16, y: 24 };

    // @ts-expect-error A pixel is not a tile: Vector2 has no col or row.
    centreOf(pixel);
    // @ts-expect-error A tile is not a pixel: Tile has no x or y.
    tileAt(tile);

    /* The real assertion above is made by the typechecker. These two record
       the shapes that keep the two spaces apart, so the test still states
       something when read on its own. */
    expect(Object.keys(tile)).toEqual(['col', 'row']);
    expect(Object.keys(pixel)).toEqual(['x', 'y']);
  });
});

describe('neighbour', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: four cases looped over ALL_DIRECTIONS with
   *   expect.assertions(5). The domain has exactly four elements, so the loop
   *   is exhaustive and a property test would add generation cost for no extra
   *   coverage. expect.assertions guards the vacuous pass documented in
   *   docs/TDD-FINDINGS.md: with an empty ALL_DIRECTIONS the loop body would
   *   never run and this test would report success while checking nothing.
   * MEASURES: that tile-space stepping moves exactly one tile and agrees with
   *   the screen convention that y — and therefore the row — grows downward.
   * ORACLE: the screen convention already pinned in direction.test.ts (up is
   *   negative y), applied to a grid whose rows increase downward. From tile
   *   (5,5): up is (5,4), left is (4,5), down is (5,6), right is (6,5). The
   *   expected tiles are written as literals rather than derived from
   *   toUnitVector, so this test cannot pass by echoing the implementation.
   * CATCHES: an inverted vertical axis in tile space. Ghosts would chase
   *   downward when their target is above, and the whole AI would look
   *   plausible while being systematically wrong.
   * LOAD-BEARING: yes — the stub returns {col:0,row:0} for every step.
   */
  it('steps exactly one tile in each direction, and up decreases the row', () => {
    const start: Tile = { col: 5, row: 5 };
    /* A total Record, so there is no undefined to check under
       noUncheckedIndexedAccess and no lookup can silently miss. */
    const expected: Readonly<Record<Direction, Tile>> = {
      [Direction.Up]: { col: 5, row: 4 },
      [Direction.Left]: { col: 4, row: 5 },
      [Direction.Down]: { col: 5, row: 6 },
      [Direction.Right]: { col: 6, row: 5 },
    };

    expect.assertions(5);
    expect(neighbour(start, Direction.Up).row).toBe(start.row - 1);
    for (const direction of ALL_DIRECTIONS) {
      expect(neighbour(start, direction)).toEqual(expected[direction]);
    }
  });
});
