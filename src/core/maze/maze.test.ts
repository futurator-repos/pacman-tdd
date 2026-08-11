import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ALL_DIRECTIONS, Direction } from '../geometry/direction.ts';
import { tinyMaze } from '../testing/tiny-maze.ts';

import { ARCADE_MAZE } from './arcade-maze.ts';
import {
  MAZE_COLUMNS,
  MAZE_ROWS,
  isWalkable,
  kindAt,
  walkableNeighbours,
  wrapPosition,
} from './maze.ts';
import { TileKind } from './tile-kind.ts';

/**
 * The board's four total queries.
 *
 * "Total" is the word that matters. Every one of these functions has an answer
 * for every input, including inputs off the edge of the grid — which is what
 * lets movement code, ghost AI and the renderer all skip the bounds check that
 * one of them would eventually forget.
 *
 * The fixtures are drawn INLINE here rather than borrowed from tiny-maze.ts, so
 * a reader can see the situation and the assertion on one screen. tiny-maze's
 * own named fixtures exist for the slices that come later, and are pinned by
 * their own test file.
 */

/**
 * Five rows holding one tile of every TileKind, so a single fixture can pin the
 * whole lookup table:
 *
 * ```
 *      col 01234
 * row 0    #####
 * row 1    #.T##      (1,1) open with a dot   (2,1) tunnel floor
 * row 2    #-H##      (1,2) the gate          (2,2) house interior
 * row 3    #P.##      (1,3) Pac-Man's spawn
 * row 4    #####
 * ```
 */
const KINDS_FIXTURE: readonly string[] = ['#####', '#.T##', '#-H##', '#P.##', '#####'];

/**
 * A four-way junction at (5,4) with a one-tile ghost house hanging above it, so
 * the same fixture serves both the ordering rule and the door rule:
 *
 * ```
 *      col 0123456789A
 * row 0    ###########
 * row 1    #####H#####
 * row 2    #####-#####      the gate, at (5,2)
 * row 3    #####.#####      (5,3): its only other exit is down
 * row 4    #....P....#      (5,4): all four exits open
 * row 5    #####.#####
 * row 6    ###########
 * ```
 */
const CROSSROADS_FIXTURE: readonly string[] = [
  '###########',
  '#####H#####',
  '#####-#####',
  '#####.#####',
  '#....P....#',
  '#####.#####',
  '###########',
];

describe('the maze grid', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Two constants. There is nothing cheaper and nothing to gain
   *   from anything more expensive.
   * MEASURES: The declared size of the arcade playfield, as the rest of the
   *   core imports it.
   * ORACLE: docs/ARCADE-REFERENCE.md — the original playfield is 28 tiles wide
   *   and 31 tall.
   * CATCHES: These two numbers drifting apart from CLASSIC_LAYOUT's actual
   *   shape. `wrapPosition` computes the playfield width from MAZE_COLUMNS, so
   *   a 27 here would deposit an actor one pixel inside the wall on every
   *   single tunnel crossing.
   * LOAD-BEARING: yes — both are stubbed to 0.
   */
  it('is 28 columns by 31 rows, matching the arcade playfield', () => {
    expect(MAZE_COLUMNS).toBe(28);
    expect(MAZE_ROWS).toBe(31);
  });
});

describe('kindAt', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One table-driven unit over a 5x5 fixture holding one tile of
   *   each kind, plus the four directions off the grid. The two halves belong in
   *   ONE test on purpose: the out-of-bounds half alone would pass against a
   *   stub that returns Wall for everything, and the in-bounds half is what
   *   makes the pair honest. A test fails if ANY of its assertions fails, so
   *   pairing them buys a real red for both claims at the cost of one test.
   * MEASURES: The lookup for wall, open, door, tunnel and house, and that reads
   *   above, below, left and right of the grid return Wall rather than
   *   undefined.
   * ORACLE: The fixture's own authored legend, plus the stated design invariant
   *   that out of bounds reads as Wall — which is also the arcade's behaviour at
   *   every board edge except the tunnel row, where wrapPosition takes over.
   * CATCHES: `undefined` leaking out of the flat array under
   *   noUncheckedIndexedAccess. It compares unequal to every TileKind, so
   *   `isWalkable` reports false down some paths and throws down others, and
   *   the crash lands in the mover rather than here. It equally catches the
   *   over-correction — a kindAt that returns Wall for everything, which freezes
   *   all five actors on the board.
   * LOAD-BEARING: yes, as a whole. Recorded honestly: the four out-of-bounds
   *   assertions DO pass against the Wall stub. The five in-bounds ones do not,
   *   and that is what turns this into a real red.
   */
  it('returns the declared kind for an in-bounds tile and Wall for any tile off the grid', () => {
    expect.assertions(9);
    const maze = tinyMaze(KINDS_FIXTURE);

    const inBounds = [
      { tile: { col: 0, row: 0 }, kind: TileKind.Wall },
      { tile: { col: 1, row: 1 }, kind: TileKind.Open },
      { tile: { col: 2, row: 1 }, kind: TileKind.Tunnel },
      { tile: { col: 1, row: 2 }, kind: TileKind.Door },
      { tile: { col: 2, row: 2 }, kind: TileKind.House },
    ];
    for (const { tile, kind } of inBounds) {
      expect(kindAt(maze, tile)).toBe(kind);
    }

    const offGrid = [
      { col: 2, row: -1 },
      { col: -1, row: 2 },
      { col: 2, row: 5 },
      { col: 5, row: 2 },
    ];
    for (const tile of offGrid) {
      expect(kindAt(maze, tile)).toBe(TileKind.Wall);
    }
  });
});

describe('isWalkable', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Two cases on one tile. This is the ENTIRE Pac-Man-versus-
   *   ghost asymmetry and it needs no movement to state, so discovering it
   *   through the mover would be pure waste.
   * MEASURES: The door branch of walkability, in both directions of the flag.
   * ORACLE: Arcade rule — ghosts pass through the ghost-house gate; Pac-Man
   *   never can, in either direction, at any point in the game.
   * CATCHES: Pac-Man walking into the ghost house — either instant death or a
   *   permanent hiding place, depending on what the ghosts are doing. With the
   *   flag inverted instead, ghosts can never leave and the game has no
   *   opposition at all.
   * LOAD-BEARING: yes — the stub returns false, so the mayPassDoor:true case
   *   fails.
   */
  it('lets an actor through the ghost-house door only when mayPassDoor is true', () => {
    const maze = tinyMaze(KINDS_FIXTURE);
    const door = { col: 1, row: 2 };

    expect(isWalkable(maze, door, true)).toBe(true);
    expect(isWalkable(maze, door, false)).toBe(false);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Table-driven over the non-door kinds in one test, with
   *   expect.assertions so an empty table cannot pass vacuously.
   * MEASURES: That walkability is decided per KIND, and specifically that a
   *   tunnel tile is ordinary open floor — the ghost slowdown in the tunnel is
   *   a SPEED rule, not a walkability rule — and that a house tile is
   *   occupiable, which is what lets three ghosts sit inside waiting.
   * ORACLE: TileKind's documented meanings in tile-kind.ts: Tunnel is "open
   *   floor, but ghosts crawl through it"; House is occupiable; Wall is never
   *   walkable by anybody.
   * CATCHES: Tunnel treated as wall. Both tunnel mouths seal, several dots
   *   become unreachable, and the board can never be cleared — while every
   *   other test in this file still passes. Or House treated as wall, in which
   *   case a ghost cannot be placed on its own spawn tile.
   * LOAD-BEARING: yes — three of the four cases expect true and the stub
   *   returns false.
   */
  it('accepts open, tunnel and house floor, and never accepts a wall', () => {
    expect.assertions(4);
    const maze = tinyMaze(KINDS_FIXTURE);

    const cases = [
      { tile: { col: 0, row: 0 }, walkable: false },
      { tile: { col: 1, row: 1 }, walkable: true },
      { tile: { col: 2, row: 1 }, walkable: true },
      { tile: { col: 2, row: 2 }, walkable: true },
    ];
    for (const { tile, walkable } of cases) {
      expect(isWalkable(maze, tile, false)).toBe(walkable);
    }
  });
});

describe('walkableNeighbours', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Unit on a crossroads fixture where all four neighbours are
   *   open, so one assertion covers the FULL ordered array. Any fixture with a
   *   wall in it would leave the order of the missing direction unstated.
   *   The test imports ALL_DIRECTIONS rather than hard-coding up/left/down/
   *   right, so reordering that array fails HERE — at a rule that depends on
   *   it — rather than in some distant ghost test three slices later.
   * MEASURES: The enumeration order of the legal moves out of a tile, and the
   *   tile each one lands on.
   * ORACLE: The arcade tie-break rule, already pinned in direction.test.ts:
   *   among candidates that are exactly equidistant from a ghost's target, the
   *   earlier direction in up / left / down / right wins. That ordering is only
   *   meaningful if the candidates are ENUMERATED in it.
   * CATCHES: A neighbour order that falls out of object key order, or out of a
   *   sorted Set. Ghost pathing would then differ from the arcade only on ties
   *   — which is a bug you can watch for an hour without being able to pin
   *   down, because it looks exactly like the ghost "changing its mind".
   * LOAD-BEARING: yes — the stub returns [], and ALL_DIRECTIONS is real.
   */
  it('returns candidates in ALL_DIRECTIONS order: up, left, down, right', () => {
    const maze = tinyMaze(CROSSROADS_FIXTURE);

    const neighbours = walkableNeighbours(maze, { col: 5, row: 4 }, false);

    expect(neighbours.map((neighbour) => neighbour.direction)).toEqual(ALL_DIRECTIONS);
    expect(neighbours.map((neighbour) => neighbour.tile)).toEqual([
      { col: 5, row: 3 },
      { col: 4, row: 4 },
      { col: 5, row: 5 },
      { col: 6, row: 4 },
    ]);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Same fixture, one tile higher, where the only difference
   *   between the two calls is the flag. Cheapest possible statement of "the
   *   door rule composes".
   * MEASURES: That the mayPassDoor flag reaches the neighbour enumeration, not
   *   only the isWalkable predicate.
   * ORACLE: Arcade rule again — a ghost heading home may turn INTO the gate;
   *   Pac-Man standing on the same tile has no such exit.
   * CATCHES: choose-direction.ts (slice s06) being forced to re-filter the door
   *   itself because this API dropped the flag. Two implementations of one rule
   *   then exist, and the day they disagree, a ghost either walks through a
   *   closed gate or refuses to go home.
   * LOAD-BEARING: yes.
   */
  it('offers the ghost-house door as an exit only to an actor that may pass it', () => {
    const maze = tinyMaze(CROSSROADS_FIXTURE);
    const belowTheDoor = { col: 5, row: 3 };

    const forPacman = walkableNeighbours(maze, belowTheDoor, false);
    const forGhost = walkableNeighbours(maze, belowTheDoor, true);

    expect(forPacman.map((neighbour) => neighbour.direction)).toEqual([Direction.Down]);
    expect(forGhost.map((neighbour) => neighbour.direction)).toEqual([
      Direction.Up,
      Direction.Down,
    ]);
  });
});

/*
 * `isNoUpTile` has no test in this file, deliberately. The rule it expresses is
 * entirely about WHICH four tiles the arcade forbids, so it is pinned against
 * the real board and its citation in arcade-maze.test.ts. Splitting it across
 * two files would leave neither half meaningful.
 */

describe('wrapPosition', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Exact expected pixels on both sides of the board, plus two
   *   controls in the same test — one inside the row, one on a different row.
   *   The mirror arithmetic is where the off-by-one lives (board width versus
   *   board width minus one), and only an exact expected value catches that;
   *   the controls are two extra lines and rule out a wrap that fires
   *   everywhere.
   * MEASURES: That the warp is gated on the ROW rather than applied board-wide,
   *   and that leaving one mouth by n pixels enters the other n pixels in.
   * ORACLE: docs/ARCADE-REFERENCE.md — the warp corridor exists only on the
   *   tunnel row, which on the 31-row playfield is row 14, and the playfield is
   *   28 tiles x 8 px = 224 px wide. y = 116 is that row's centre line
   *   (14 * 8 + 4). The tunnel is continuous, so motion across it is unbroken:
   *   x = -1 becomes 224 - 1 = 223.
   * CATCHES: A global wrap applied on every row, which masks genuine
   *   out-of-bounds bugs everywhere else by silently teleporting the actor back
   *   onto the board. Or a one-pixel jump at the warp, which desynchronises the
   *   sub-pixel carry so that Pac-Man and the ghosts leave the tunnel on
   *   different frames than the arcade would — the difference between escaping
   *   Blinky and not.
   * LOAD-BEARING: yes — the stub returns {x:0,y:0} for everything.
   */
  it('warps only on the tunnel row, and the two mouths are exact mirror images', () => {
    expect(wrapPosition(ARCADE_MAZE, { x: -1, y: 116 })).toEqual({ x: 223, y: 116 });
    expect(wrapPosition(ARCADE_MAZE, { x: 224, y: 116 })).toEqual({ x: 0, y: 116 });
    expect(wrapPosition(ARCADE_MAZE, { x: 100, y: 116 })).toEqual({ x: 100, y: 116 });
    expect(wrapPosition(ARCADE_MAZE, { x: -1, y: 4 })).toEqual({ x: -1, y: 4 });
  });

  /*
   * TYPE: property
   * WHY THIS TYPE: Idempotence is a claim about EVERY x on the tunnel row,
   *   including the far overshoots a hand-written example would never think to
   *   try, and fast-check shrinks any violation to the smallest failing x. The
   *   slice describes this as an involution; realised concretely it is
   *   idempotence, because a wrapped position is already on the board.
   * MEASURES: That wrapPosition lands inside the board in a SINGLE application,
   *   for any input at all.
   * ORACLE: The stated postcondition of wrapPosition — the result is on the
   *   board — which forces f(f(x)) === f(x) for every x.
   * CATCHES: A wrap implemented as one subtraction rather than a modulo. For a
   *   normal one-pixel overshoot it behaves perfectly; for a large one (a
   *   restored replay, a paused tab catching up) the actor is deposited outside
   *   the board on the far side, off-screen and unrecoverable.
   * LOAD-BEARING: NO — a guard, and honestly so. The constant stub satisfies
   *   idempotence trivially, and so would an identity function. It pins nothing
   *   on its own; it exists to stop the exact test above from being satisfied by
   *   arithmetic that only works for the two pixels it names.
   */
  it('leaves an already-wrapped position alone, however far it overshot', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10_000, max: 10_000 }), (x) => {
        const once = wrapPosition(ARCADE_MAZE, { x, y: 116 });

        expect(wrapPosition(ARCADE_MAZE, once)).toEqual(once);
      }),
    );
  });
});
