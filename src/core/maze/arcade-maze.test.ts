import { describe, expect, it } from 'vitest';

import { GhostId } from '../ghost/ghost-id.ts';

import { ARCADE_MAZE, mazeForLevel } from './arcade-maze.ts';
import { isNoUpTile, kindAt, walkableNeighbours } from './maze.ts';
import { TileKind } from './tile-kind.ts';

/**
 * The one board the game actually plays on.
 *
 * classic-layout.test.ts checks the ASCII; parse-maze.test.ts checks the
 * translation. This file checks the RESULT — the handful of special tiles that
 * the rest of the game navigates toward, each pinned to the arcade coordinate a
 * reader can go and verify.
 *
 * The four scatter corners are deliberately NOT here. They are pinned in
 * src/core/ghost/targeting/scatter-corners.test.ts, next to the rule that
 * consumes them, so their absence is a decision rather than a gap.
 */

/** A stable key for a tile, so a flood fill can use a Set without identity bugs. */
function tileKey(tile: { readonly col: number; readonly row: number }): string {
  return `${String(tile.col)},${String(tile.row)}`;
}

describe('ARCADE_MAZE', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Constants with nothing to integrate. The ghost spawns are
   *   asserted as one record keyed by GhostId rather than as four separate
   *   lookups, so the assertion READS like the data it pins and a swapped pair
   *   shows up as a two-line diff.
   * MEASURES: That the special tiles the rest of the game navigates toward were
   *   transcribed correctly from the arcade board.
   * ORACLE: docs/ARCADE-REFERENCE.md, coordinate by coordinate, zero-based on
   *   the 28x31 playfield. Pac-Man starts at (13,23); Blinky starts OUTSIDE the
   *   house, directly above the gate, at (13,11); Pinky waits at the house
   *   centre (13,14) with Inky at (11,14) and Clyde at (15,14); the gate's left
   *   tile is (13,12); the bonus fruit appears at (13,17), below the house.
   * CATCHES: Inky's and Clyde's house positions swapped. Nothing looks wrong —
   *   four ghosts still sit in the house — but they reach the gate in a
   *   different order, which breaks the release sequence the arcade guarantees
   *   and therefore every documented level-1 pattern. It equally catches a
   *   transposed col/row, which the symmetric board hides well.
   * LOAD-BEARING: yes — the stub parse yields (0,0) for every one of them.
   */
  it('pins the ghost spawns, house door, house centre and fruit tile to their documented coordinates', () => {
    expect(ARCADE_MAZE.pacmanSpawn).toEqual({ col: 13, row: 23 });
    expect(ARCADE_MAZE.ghostSpawns).toEqual({
      [GhostId.Blinky]: { col: 13, row: 11 },
      [GhostId.Pinky]: { col: 13, row: 14 },
      [GhostId.Inky]: { col: 11, row: 14 },
      [GhostId.Clyde]: { col: 15, row: 14 },
    });
    expect(ARCADE_MAZE.houseDoorTile).toEqual({ col: 13, row: 12 });
    expect(ARCADE_MAZE.houseCentreTile).toEqual({ col: 13, row: 14 });
    expect(ARCADE_MAZE.fruitTile).toEqual({ col: 13, row: 17 });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A census plus four coordinates against the parsed board. It
   *   is separate from the ASCII census in classic-layout.test.ts on purpose:
   *   that one asks "did you TYPE the board correctly", this one asks "did the
   *   PARSER put each character in the right list".
   * MEASURES: That `pelletTiles` and `powerPelletTiles` are two DISJOINT lists
   *   of the documented sizes, and that the energizers are the four tiles the
   *   arcade puts them on.
   * ORACLE: docs/ARCADE-REFERENCE.md — 240 dots and 4 energizers per level, the
   *   energizers at columns 1 and 26 of rows 3 and 23, zero-based. The same
   *   external fact classic-layout.test.ts checks against the ASCII.
   * CATCHES: The gap this test was added to close during VERIFY-RED. Every
   *   other test in the slice reads the two lists only as a UNION — the flood
   *   fill builds one Set from both — so a parser that filed the four
   *   energizers in BOTH lists passed the whole slice: the Set de-duplicates
   *   back to 244, and renderMaze's precedence (`o` before `.`) keeps the round
   *   trip green. The 248-dot board would then surface three slices later, in
   *   s07's PelletField, as a level that can never be cleared.
   * LOAD-BEARING: yes — the stub parse yields two empty lists.
   *
   * Asserted as a SET, deliberately. `Maze` does not specify the order of
   * either list, so an ordered toEqual here would pin an implementation detail
   * and block a refactor that changed the traversal.
   */
  it('splits the 244 dots into 240 pellets and the 4 energizers at (1,3) (26,3) (1,23) (26,23)', () => {
    expect(ARCADE_MAZE.pelletTiles).toHaveLength(240);
    expect(ARCADE_MAZE.powerPelletTiles).toHaveLength(4);
    expect(new Set(ARCADE_MAZE.powerPelletTiles.map(tileKey))).toEqual(
      new Set(['1,3', '26,3', '1,23', '26,23']),
    );
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Unit against the real board with the coordinates in the test
   *   name, so the claim is checkable rather than trusted. Cheap, because it
   *   pins only the DATA. The RULE that a ghost may not choose up on these
   *   tiles belongs to choose-direction.ts and is tested there.
   * MEASURES: That the four no-up tiles were transcribed correctly, AND that
   *   their immediate neighbours were not swept in with them.
   * ORACLE: docs/ARCADE-REFERENCE.md — the original hardware forbids a ghost
   *   from selecting "up" at four tiles: (12,11) and (15,11), just above the
   *   ghost house, and (12,23) and (15,23), lower down the board. (Zero-based
   *   on the 31-row playfield; the same tiles are rows 14 and 26 when counted
   *   on the 36-row screen, which is how most references print them.)
   * CATCHES: A transposed col/row in one entry. Up is then forbidden on an
   *   innocent corridor tile and permitted where the arcade forbids it, which
   *   changes every ghost route through those two junctions — and those
   *   junctions are precisely the ones the classic escape patterns exploit.
   *   The four false cases are what stop a "return true for everything"
   *   implementation from passing, which would freeze every ghost's upward turn
   *   on the whole board.
   * LOAD-BEARING: yes — the four true cases fail against a stub that says false.
   */
  it('forbids an upward turn on exactly the four no-up tiles (12,11) (15,11) (12,23) (15,23)', () => {
    expect.assertions(8);

    const forbidden = [
      { col: 12, row: 11 },
      { col: 15, row: 11 },
      { col: 12, row: 23 },
      { col: 15, row: 23 },
    ];
    for (const tile of forbidden) {
      expect(isNoUpTile(ARCADE_MAZE, tile)).toBe(true);
    }

    const innocent = [
      { col: 13, row: 11 },
      { col: 16, row: 11 },
      { col: 11, row: 23 },
      { col: 15, row: 22 },
    ];
    for (const tile of innocent) {
      expect(isNoUpTile(ARCADE_MAZE, tile)).toBe(false);
    }
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Three facts about one row. A unit states them exactly;
   *   driving an actor through the tunnel to discover them is slice s03's job
   *   and would confuse "the board has a tunnel" with "the mover handles one".
   * MEASURES: Which row the tunnel is on, and that it genuinely reaches both
   *   edges of the board rather than stopping a tile short.
   * ORACLE: docs/ARCADE-REFERENCE.md — the warp corridor runs along playfield
   *   row 14 (screen row 17) and is open at both column 0 and column 27.
   * CATCHES: A tunnel authored one row off, which puts the warp on a row of
   *   solid wall: the tunnel simply stops working, and because the maze still
   *   parses and still holds 244 dots, nothing else notices. It also catches
   *   the edge tiles being authored as plain open floor, which leaves the warp
   *   working but removes the ghost slowdown that makes the tunnel an escape
   *   route at all.
   * LOAD-BEARING: yes — the stub board reports tunnelRow -1.
   */
  it('runs its tunnel along row 14, open at both edges of the board', () => {
    expect(ARCADE_MAZE.tunnelRow).toBe(14);
    expect(kindAt(ARCADE_MAZE, { col: 0, row: 14 })).toBe(TileKind.Tunnel);
    expect(kindAt(ARCADE_MAZE, { col: 27, row: 14 })).toBe(TileKind.Tunnel);
  });
});

describe('mazeForLevel', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: A lookup with one documented answer. Note the first two
   *   assertions use the arcade's literal 28 and 31 rather than MAZE_COLUMNS
   *   and MAZE_ROWS: comparing one stub against another is how a test passes
   *   while checking nothing.
   * MEASURES: That every level resolves to the same board, and that the board
   *   is built ONCE rather than re-parsed per call.
   * ORACLE: docs/ARCADE-REFERENCE.md for the 28x31 size, plus the stated scope
   *   exclusion in docs/ARCHITECTURE.md: the original alternates a second maze
   *   from level 21, and the second maze is out of scope, so this function is
   *   the one place that fact lives.
   * CATCHES: buildScene and tick each resolving the maze their own way and
   *   drifting apart — the rules saying a wall is where the picture shows floor.
   *   The identity assertions also catch a per-call re-parse, which would run
   *   the 868-tile parser sixty times a second and break `toBe` comparisons in
   *   every later test that treats a Maze as a value.
   * LOAD-BEARING: yes, on the first two assertions. Recorded honestly: the two
   *   identity assertions PASS against the stub, because the stub already
   *   returns the single module-level ARCADE_MAZE. They are a guard.
   */
  it('resolves every level to the one 28 by 31 board, built once', () => {
    expect(mazeForLevel(1).columns).toBe(28);
    expect(mazeForLevel(1).rows).toBe(31);
    expect(mazeForLevel(7)).toBe(ARCADE_MAZE);
    expect(mazeForLevel(256)).toBe(mazeForLevel(1));
  });
});

describe('the playable board', () => {
  /*
   * TYPE: integration
   * WHY THIS TYPE: It composes parseMaze, kindAt, isWalkable and
   *   walkableNeighbours over the real 28x31 board via a flood fill. No unit
   *   test can express REACHABILITY — it is a property of the whole board and
   *   of four functions cooperating — and reachability alone decides whether a
   *   level can be finished at all. It still runs in well under a millisecond,
   *   so it does not belong any further up the pyramid.
   * MEASURES: The number of dot and energizer tiles inside the flood fill that
   *   starts at Pac-Man's spawn and may not cross the ghost-house gate.
   * ORACLE: The game rule plus docs/ARCADE-REFERENCE.md — a level ends when all
   *   244 dots are eaten, so all 244 must be reachable by an actor who cannot
   *   pass the door. Anything less and the game is unwinnable.
   * CATCHES: A single wall character typed into a corridor, sealing off a
   *   pocket of the board. The maze parses, the census still says 240 and 4,
   *   the symmetry test still passes, the board still LOOKS right — and the
   *   game can never be completed from level 1 onward.
   * LOAD-BEARING: yes. Note the phrasing: it asserts the reached count EQUALS
   *   244, not "every pellet was reached". The latter is vacuously true of a
   *   board with no pellets, which is exactly what the stub produces. The
   *   `dots.size` assertion is the same defence one step earlier — it stops the
   *   denominator itself from being wrong.
   */
  it('reaches all 244 dots from Pac-Man spawn without crossing the house door', () => {
    const dots = new Set<string>();
    for (const tile of ARCADE_MAZE.pelletTiles) {
      dots.add(tileKey(tile));
    }
    for (const tile of ARCADE_MAZE.powerPelletTiles) {
      dots.add(tileKey(tile));
    }

    const reached = new Set<string>();
    const frontier = [ARCADE_MAZE.pacmanSpawn];
    while (frontier.length > 0) {
      const tile = frontier.pop();
      if (tile === undefined) {
        break;
      }
      if (reached.has(tileKey(tile))) {
        continue;
      }
      reached.add(tileKey(tile));
      /* mayPassDoor is false: this is the region PAC-MAN can walk. */
      for (const neighbour of walkableNeighbours(ARCADE_MAZE, tile, false)) {
        if (!reached.has(tileKey(neighbour.tile))) {
          frontier.push(neighbour.tile);
        }
      }
    }

    let reachedDots = 0;
    for (const key of dots) {
      if (reached.has(key)) {
        reachedDots += 1;
      }
    }

    expect(dots.size).toBe(244);
    expect(reachedDots).toBe(244);
  });
});
