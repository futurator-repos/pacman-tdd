import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ALL_DIRECTIONS, Direction, opposite } from '../geometry/direction.ts';
import { type Tile } from '../geometry/tile.ts';
import { type Maze, isNoUpTile, isWalkable, walkableNeighbours } from '../maze/maze.ts';
import { corridorMaze, crossroadsMaze, deadEndMaze } from '../testing/tiny-maze.ts';

import { chooseDirection } from './choose-direction.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * This is the heart of ghost movement. The four personalities in `targeting/`
 * decide WHERE a ghost wants to be; this one function decides which way it
 * actually turns, and it is the only place the maze, the target and the ghost's
 * facing meet. Every ghost in the game is this rule plus a target tile.
 *
 * The rule, from docs/ARCADE-REFERENCE.md section 9, "The turn decision":
 *
 *   1. list the legal exits from the current tile;
 *   2. drop the reversal, and drop `up` if this is one of the four no-up tiles;
 *   3. if that left nothing, put the dropped exits back (the dead end);
 *   4. take the exit whose NEIGHBOUR TILE is nearest the target by squared
 *      distance, breaking exact ties in ALL_DIRECTIONS order: up, left, down,
 *      right.
 *
 * Step 4 is worth staring at. The distance is measured from each CANDIDATE
 * NEIGHBOUR, not from the ghost's own tile. Measured from the ghost, every
 * candidate scores the same and all four ghosts collapse onto the tie-break
 * order — they move identically, the AI looks broken, and nothing crashes.
 *
 * ---------------------------------------------------------------------------
 * WHY THE FIXTURES ARE ELEVEN COLUMNS WIDE
 *
 * `crossroadsMaze()` is a hand-drawn board with a four-way junction at (5,4):
 *
 *        col 0123456789A
 *   row 0    ###########
 *   row 1    #####H#####
 *   row 2    #####-#####
 *   row 3    #####.#####
 *   row 4    #....P....#
 *   row 5    #####.#####
 *   row 6    ###########
 *
 * A reader can check every expectation below by counting squares. Running the
 * same decisions on the 28x31 arcade board would prove the same thing while
 * hiding it: you would have to trust that (12,14) really is a junction. A test
 * should show its own situation.
 * ---------------------------------------------------------------------------
 */

/** The junction at the middle of `crossroadsMaze()`. All four exits are open. */
const JUNCTION: Tile = { col: 5, row: 4 };

/**
 * The crossroads, with its junction marked as one of the arcade's no-up tiles.
 *
 * Built by spreading the fixture rather than by authoring a fourth ASCII layout,
 * because the no-up quirk has NO representation in the ASCII: it is a ROM fact
 * about four specific coordinates, which is why `parseMaze` leaves `noUpTiles`
 * empty and `arcade-maze.ts` applies the real four. Spreading here keeps the
 * board and the quirk visibly separate, exactly as the production code does.
 */
function noUpCrossroads(): Maze {
  const maze = crossroadsMaze();
  /* `noUpTiles` is keyed by the flat, row-major index — row * columns + col.
     Taken from the fixture's own width rather than written as the literal 11,
     so a fixture that grows a column does not silently mark a different tile. */
  const index = JUNCTION.row * maze.columns + JUNCTION.col;
  return { ...maze, noUpTiles: new Set([index]) };
}

/**
 * The earliest of `candidates` in the arcade's tie-break order.
 *
 * The expectation is DERIVED from `ALL_DIRECTIONS` rather than written as a
 * literal, and that is the whole point of the helper: reordering that array
 * would break ghost pathing everywhere, and this is the rule that depends on
 * it, so the failure should land here rather than in a distant replay fixture.
 *
 * It throws instead of returning `undefined` because a helper that quietly
 * hands back a missing value turns the assertion that consumes it into
 * `expect(undefined).toBe(undefined)` — the vacuous pass of
 * docs/TDD-FINDINGS.md, failure mode 2.
 */
function firstInArcadeOrder(candidates: readonly Direction[]): Direction {
  const found = ALL_DIRECTIONS.find((direction) => candidates.includes(direction));
  if (found === undefined) {
    throw new Error(`none of ${candidates.join(', ')} appears in ALL_DIRECTIONS`);
  }
  return found;
}

describe('chooseDirection', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: the core decision rule, isolated from movement and from
   *   targeting. A hand-drawn crossroads makes the right answer checkable by
   *   eye; routing the same decision through `ghost-system` would add a maze, a
   *   speed and a frame and answer no extra question.
   * MEASURES: two things, because "nearest" has two ways to go wrong — WHERE the
   *   distance is measured from, and WHICH distance is measured.
   *
   *   1. MEASURED FROM THE NEIGHBOUR. Ghost on the junction (5,4) facing left,
   *      target (2,4) — straight along the ghost's own row:
   *        up    -> (5,3): 3^2 + 1^2 = 10
   *        left  -> (4,4): 2^2 + 0^2 =  4   <- nearest
   *        down  -> (5,5): 3^2 + 1^2 = 10
   *        right -> (6,4): reversal, not a candidate
   *      Measured from the ghost's own tile every candidate scores the same.
   *
   *   2. THE DISTANCE IS EUCLIDEAN (compared squared), NOT MANHATTAN. The first
   *      case cannot show that, because a target on the ghost's own row makes
   *      every metric agree — the degenerate fixture docs/TDD-FINDINGS.md warns
   *      about. So the second call puts the target DIAGONALLY off the board at
   *      (0,0), same junction, same facing:
   *        up   -> (5,3): squared 25 + 9  = 34   manhattan 5 + 3 =  8
   *        left -> (4,4): squared 16 + 16 = 32   manhattan 4 + 4 =  8   <- squared answer
   *        down -> (5,5): squared 25 + 25 = 50   manhattan 5 + 5 = 10
   *      Squared distance says left. Manhattan ties up with left at 8 and the
   *      tie-break hands it to up; a row-only distance also says up (3 vs 4).
   *      One assertion, and the whole imposter family is dead.
   * ORACLE: docs/ARCADE-REFERENCE.md section 9, "The turn decision" — at a
   *   junction the ghost looks at the tile each exit leads to and takes the one
   *   nearest its target in STRAIGHT-LINE distance, compared as squared distance
   *   because the arcade never takes a square root.
   * CATCHES: distance measured from the ghost's own tile instead of from each
   *   neighbour. Every candidate then ties, the tie-break decides everything,
   *   and all four ghosts walk the same route while every targeting test in
   *   `targeting/` still passes. Also catches a Manhattan or single-axis
   *   distance, which is right along a row or a column and wrong on every
   *   diagonal — so the ghosts corner correctly and pick the wrong branch in
   *   open space, which reads as "the AI feels off" and never as a bug.
   * LOAD-BEARING: yes — the stub returns Direction.Right, and both answers are
   *   left.
   */
  it('takes the exit whose neighbour tile is nearest the target by squared distance', () => {
    expect(
      chooseDirection({
        maze: crossroadsMaze(),
        tile: JUNCTION,
        facing: Direction.Left,
        target: { col: 2, row: 4 },
        mayPassDoor: true,
      }),
    ).toBe(Direction.Left);

    expect(
      chooseDirection({
        maze: crossroadsMaze(),
        tile: JUNCTION,
        facing: Direction.Left,
        target: { col: 0, row: 0 },
        mayPassDoor: true,
      }),
    ).toBe(Direction.Left);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: one pure function, one qualifier. The fixture is chosen so
   *   that the FORBIDDEN answer is also the BEST answer — which is the only
   *   arrangement in which "never reverses" is observable at all.
   * MEASURES: ghost on the junction facing right, so the reversal is left, with
   *   the target at (0,5) — down and away to the left:
   *     left  -> (4,4): 4^2 + 1^2 = 17   <- nearest, and forbidden
   *     down  -> (5,5): 5^2 + 0^2 = 25   <- the answer
   *     up    -> (5,3): 5^2 + 2^2 = 29
   *     right -> (6,4): 6^2 + 1^2 = 37
   * ORACLE: docs/ARCADE-REFERENCE.md section 9, quoting the Dossier: "Ghosts are
   *   never allowed to reverse direction". The only reversals in the game are
   *   the ones the system forces on a scatter/chase flip (section 4).
   * CATCHES: the reversal filter omitted. A ghost pinned in a corridor
   *   oscillates between two tiles forever, and — because the mode-flip reversal
   *   is the arcade's only escape from exactly that — the bug looks like a
   *   pathing problem rather than a missing filter.
   * LOAD-BEARING: yes — the stub returns Direction.Right, the answer is down.
   */
  it('never reverses, even when the reversal is the nearest exit to the target', () => {
    expect(
      chooseDirection({
        maze: crossroadsMaze(),
        tile: JUNCTION,
        facing: Direction.Right,
        target: { col: 0, row: 5 },
        mayPassDoor: true,
      }),
    ).toBe(Direction.Down);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: a determinism rule. The expectation is derived from
   *   ALL_DIRECTIONS through `firstInArcadeOrder`, so reordering that array
   *   fails HERE — at the rule that depends on the order — instead of surfacing
   *   as a replay that stopped reproducing three slices later.
   * MEASURES: two genuinely equal distances, and separately three.
   *   Two-way, facing left (reversal right), target (4,3):
   *     up   -> (5,3): 1^2 + 0^2 = 1
   *     left -> (4,4): 0^2 + 1^2 = 1     tied with up
   *     down -> (5,5): 0^2 + 2^2 = 4
   *   Three-way, facing up (reversal down), target (5,4) — the ghost is standing
   *   ON its target, which is what an eaten ghost reaching the house door or a
   *   scatter ghost reaching its corner actually does:
   *     up    -> (5,3): 1
   *     left  -> (4,4): 1
   *     right -> (6,4): 1                all three tied
   * ORACLE: docs/ARCADE-REFERENCE.md section 9 — the ROM evaluates candidates in
   *   the order up, left, down, right and keeps one only when it is STRICTLY
   *   nearer, so the earliest of an equal set wins and right can never win a tie.
   * CATCHES: a tie resolved by whatever order the exits happened to be built in,
   *   or by Object.keys. Two runs of one replay diverge at the first tie and
   *   every committed fixture starts failing for reasons nobody can localise.
   * LOAD-BEARING: yes — both expectations are up; the stub returns right.
   */
  it('breaks an exact distance tie in ALL_DIRECTIONS order: up, then left, then down', () => {
    expect(
      chooseDirection({
        maze: crossroadsMaze(),
        tile: JUNCTION,
        facing: Direction.Left,
        target: { col: 4, row: 3 },
        mayPassDoor: true,
      }),
    ).toBe(firstInArcadeOrder([Direction.Up, Direction.Left]));

    expect(
      chooseDirection({
        maze: crossroadsMaze(),
        tile: JUNCTION,
        facing: Direction.Up,
        target: JUNCTION,
        mayPassDoor: true,
      }),
    ).toBe(firstInArcadeOrder([Direction.Up, Direction.Left, Direction.Right]));
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: the quirk is a property of four coordinates, so a unit can
   *   put a ghost on one of them directly. Reaching a real no-up tile through
   *   the game would take a minute of simulated play to assert one enum value.
   * MEASURES: the same junction, the same facing and the same target, with and
   *   without the tile in `noUpTiles`. Target (5,0) is straight up:
   *     up   -> (5,3): 0^2 + 3^2 =  9   <- nearest, and forbidden on a no-up tile
   *     left -> (4,4): 1^2 + 4^2 = 17   <- the answer when up is forbidden
   *     down -> (5,5): 0^2 + 5^2 = 25
   *   Asserting both halves is what makes this test load-bearing rather than a
   *   guard: one call must return up and the other must not, so no constant can
   *   satisfy both.
   * ORACLE: docs/ARCADE-REFERENCE.md section 9, point 3 — on four tiles of the
   *   original board a ghost may not choose to turn upward. It is a quirk of the
   *   code, not of the walls, which is why the tile is walkable and the choice
   *   is not.
   * CATCHES: the no-up rule omitted, or implemented as a wall. Ghosts take
   *   shortcuts the arcade forbids, the two long side corridors stop working as
   *   escape routes, and the board plays measurably easier — with no crash and
   *   no other failing test.
   * LOAD-BEARING: yes — the stub returns right, and neither expectation is right.
   */
  it('never chooses up out of a no-up tile, though it would choose up out of the same tile otherwise', () => {
    const turn = {
      tile: JUNCTION,
      facing: Direction.Left,
      target: { col: 5, row: 0 },
      mayPassDoor: true,
    };

    expect(chooseDirection({ ...turn, maze: crossroadsMaze() })).toBe(Direction.Up);
    expect(chooseDirection({ ...turn, maze: noUpCrossroads() })).toBe(Direction.Left);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: a totality case. The dead end is constructed directly;
   *   waiting for a ghost to wander into one during an integration test would be
   *   slow and would depend on the very rule under test.
   * MEASURES: in `deadEndMaze()` the tile (5,3) has exactly one non-wall
   *   neighbour, (4,3), and the ghost arrived facing right — so the only exit IS
   *   the reversal. `chooseDirection` must return it rather than throwing on an
   *   empty candidate list or returning the facing into a wall.
   * ORACLE: docs/ARCADE-REFERENCE.md section 9.1, "The dead end" — the
   *   no-reversal rule is a
   *   preference applied to the candidate list, not an absolute prohibition. A
   *   ghost that enters a dead end comes back out; the real board has such
   *   pockets around the ghost house.
   * CATCHES: the reversal filtered unconditionally. The candidate list comes
   *   back empty and the game throws mid-frame, or the ghost walks into the wall
   *   and freezes. It is reachable only on specific tiles, so it ships.
   * LOAD-BEARING: yes — the answer is left; the stub returns right.
   */
  it('takes the reversal in a dead end, where it is the only legal exit', () => {
    expect(
      chooseDirection({
        maze: deadEndMaze(),
        tile: { col: 5, row: 3 },
        facing: Direction.Right,
        target: { col: 0, row: 3 },
        mayPassDoor: true,
      }),
    ).toBe(Direction.Left);
  });

  /**
   * TYPE: property
   * WHY THIS TYPE: three invariants that must hold for EVERY tile, facing and
   *   target, not for the five a developer thought of. The examples above pin
   *   one situation each; a no-up rule applied on three of four tiles, or a
   *   reversal filter that only works when exactly two exits exist, survives all
   *   of them. fast-check generates the combinations and shrinks a failure to
   *   the smallest board and target that break it.
   * MEASURES: over every walkable tile of four fixtures (corridor, crossroads,
   *   dead end, and the crossroads with its junction marked no-up), every
   *   facing, and targets ranging off the board in both directions:
   *     1. the result is always one of `walkableNeighbours` — never into a wall;
   *     2. the result is always in the PERMITTED set: the legal exits minus the
   *        reversal and minus up-out-of-a-no-up-tile, falling back to the full
   *        set when those two preferences would leave nothing (section 9.1,
   *        "The dead end").
   *   The two preferences are expressed as one filtered set rather than as two
   *   `if`s around an `expect`, because an assertion inside a branch is silently
   *   skipped by any input that does not take the branch.
   * ORACLE: the three stated invariants of the arcade decision rule,
   *   docs/ARCADE-REFERENCE.md section 9 and 9.1 — no walking into walls, no
   *   mid-corridor reversal, and the four tiles where up is forbidden.
   * CATCHES: exactly the partial implementations the examples miss. It also
   *   catches an off-by-one in the fallback: an implementation that restores the
   *   dropped candidates whenever the preferred list is SHORT rather than EMPTY
   *   would reverse in ordinary corridors and pass every example above.
   * LOAD-BEARING: yes — the stub returns right unconditionally, which is a wall
   *   from most tiles and the reversal whenever the ghost faces left.
   * NOTE ON VACUITY: `checks` counts the property body's executions and is
   *   asserted afterwards, because a generator that produced nothing would leave
   *   every `expect` unevaluated and the test would report success while
   *   checking nothing — docs/TDD-FINDINGS.md, failure mode 2.
   */
  it('never walks into a wall, never reverses unless cornered, and never turns up on a no-up tile', () => {
    const mazes: readonly Maze[] = [
      corridorMaze(),
      crossroadsMaze(),
      deadEndMaze(),
      noUpCrossroads(),
    ];

    /* Every (maze, tile) pair a ghost could legally stand on, flattened so that
       fast-check can index it with a plain integer. `mayPassDoor` is true
       throughout: ghosts cross the gate, and it is the gate tiles that give the
       house its only exit. */
    const places: { readonly maze: Maze; readonly tile: Tile }[] = [];
    for (const maze of mazes) {
      for (let row = 0; row < maze.rows; row += 1) {
        for (let col = 0; col < maze.columns; col += 1) {
          const tile: Tile = { col, row };
          if (isWalkable(maze, tile, true)) {
            places.push({ maze, tile });
          }
        }
      }
    }

    const runs = 200;
    let checks = 0;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: places.length - 1 }),
        fc.constantFrom(...ALL_DIRECTIONS),
        fc.record({
          col: fc.integer({ min: -3, max: 14 }),
          row: fc.integer({ min: -3, max: 10 }),
        }),
        (placeIndex, facing, target) => {
          const place = places[placeIndex];
          if (place === undefined) {
            throw new Error(`no place at index ${String(placeIndex)}`);
          }
          const { maze, tile } = place;

          const exits = walkableNeighbours(maze, tile, true).map((exit) => exit.direction);
          const chosen = chooseDirection({ maze, tile, facing, target, mayPassDoor: true });

          /* 1. NEVER INTO A WALL. Subsumed by the second assertion below, and
             kept anyway: when an implementation walks through a wall this is the
             message that says so in four words. */
          expect(exits).toContain(chosen);

          /* 2. NO MID-CORRIDOR REVERSAL, AND NO UP OUT OF A NO-UP TILE.
             Both are stated as ONE set of permitted answers rather than as two
             conditional assertions, because a conditional `expect` can be
             skipped by the very input that would have failed it — the vitest
             rule `no-conditional-expect` exists for exactly that reason, and the
             filters below are the same rule expressed as data. The fallback on
             the last line is docs/ARCADE-REFERENCE.md section 9.1, "The dead
             end": when the two
             preferences would leave nothing at all, they yield. */
          const reversal = opposite(facing);
          const preferred = exits.filter(
            (direction) =>
              direction !== reversal && !(isNoUpTile(maze, tile) && direction === Direction.Up),
          );
          const permitted = preferred.length > 0 ? preferred : exits;

          expect(permitted).toContain(chosen);

          checks += 1;
        },
      ),
      { numRuns: runs },
    );

    expect(checks).toBeGreaterThanOrEqual(runs);
  });
});
