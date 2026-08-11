import { describe, expect, it } from 'vitest';

import { ALL_DIRECTIONS, Direction } from '../../geometry/direction.ts';
import type { Tile } from '../../geometry/tile.ts';
import { GhostId } from '../ghost-id.ts';
import { type Ghost, GhostPhase } from '../ghost.ts';

import { blinkyTarget } from './blinky.ts';
import type { TargetContext } from './target-context.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * Blinky is the simplest of the four personalities and therefore the best place
 * to state the shape all four share: a ghost's "target" is a pure function of a
 * TargetContext and nothing else — no maze traversal, no frame counter, no
 * movement. `choose-direction.ts` (slice s06) turns a target into a turn; this
 * file only says where the ghost WANTS to be.
 *
 * Blinky's rule, from docs/ARCADE-REFERENCE.md: his chase target is Pac-Man's
 * current tile — exactly, offset (0, 0). Facing is Pinky's and Inky's input;
 * Blinky never reads it.
 *
 * ---------------------------------------------------------------------------
 * A NOTE ON THE `import type` LINES ABOVE, AND ON THE UNANNOTATED FIXTURE
 *
 * `Tile` (slice s01) and `Maze` (slice s02) belong to slices built in parallel
 * with this one, and a parallel slice may not have landed yet. Types from them
 * use `import type` — the STATEMENT form, not the inline `{ type X }` form,
 * which would leave a real side-effect import behind. `verbatimModuleSyntax`
 * erases the statement form completely, so this test EXECUTES and fails on its
 * assertion even when the other module is absent. That distinction is the whole
 * point of an honest red: a suite that dies on a missing module has proved
 * nothing about its own expectations. Both modules landed from their own slices
 * while this file was being written, which is precisely the situation the
 * erasing form exists for: a test must not care whether a sibling slice has
 * arrived yet.
 * ---------------------------------------------------------------------------
 */

/** Any tile a long way from the origin, so no assertion here can be satisfied
 *  by a stub returning the inert `{ col: 0, row: 0 }`. */
const PACMAN_TILE: Tile = { col: 21, row: 23 };

const ORIGIN: Tile = { col: 0, row: 0 };

/**
 * TargetContext requires a Maze because one rule (Eyes heading for the house
 * door) needs one. Blinky's rule never reads it, hence the name: an assertion
 * in this file cannot accidentally depend on maze data.
 *
 * It needs no `: Maze` annotation to be safe: `TargetContext.maze` is typed
 * `Maze`, so handing this object over below is already checked against the real
 * interface. It is written out by hand rather than taken from slice s02's
 * `tiny-maze.ts` because that fixture is itself a RED-phase stub today, and a
 * test built on another slice's inert stub asserts nothing you can trust.
 */
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

/** Blinky himself, parked somewhere irrelevant. His own position is not an
 *  input to his rule — of the four, only Clyde's reads the ghost's position. */
const BLINKY: Ghost = {
  id: GhostId.Blinky,
  actor: {
    position: { x: 100, y: 100 },
    facing: Direction.Left,
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

function contextFacing(pacmanFacing: Direction): TargetContext {
  return {
    maze: IRRELEVANT_MAZE,
    pacmanTile: PACMAN_TILE,
    pacmanFacing,
    /* Offered to every targeter because Inky needs it. Blinky must ignore it,
       and it is deliberately NOT equal to pacmanTile, so a rule that confused
       the two would be caught here. */
    blinkyTile: { col: 12, row: 12 },
    /* GlobalMode lives in slice s04's mode-schedule.ts; 'chase' is the literal
       this slice assumes. Scatter is dispatched by targetFor, not here. */
    mode: 'chase',
  };
}

describe('blinkyTarget', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: a pure Tile-in / Tile-out function. A unit is the only type
   *   that can state the rule without also asserting movement, and it lets
   *   facing-invariance be a loop inside one test rather than four hand-built
   *   game states. Anything more expensive — ticking until Blinky moves — would
   *   exercise the mover and the AI at once and leave a failure ambiguous about
   *   which of the two broke.
   * MEASURES: that blinkyTarget returns ctx.pacmanTile unchanged, and returns
   *   the identical tile for all four values of pacmanFacing.
   * ORACLE: docs/ARCADE-REFERENCE.md — Blinky (Akabei, "Shadow") chases with
   *   target = Pac-Man's current tile, offset (0, 0) tiles. The expected value
   *   {col: 21, row: 23} is the fixture's own pacmanTile BY THAT RULE, not by
   *   observation of any implementation.
   * CATCHES: Blinky given a one-tile lead "so he feels smarter", or his rule
   *   quietly picking up Pinky's facing offset. He then overshoots at corners,
   *   level 1's whole difficulty curve changes, and nothing else in the suite
   *   notices.
   * LOAD-BEARING: yes — a do-nothing stub returns {col: 0, row: 0} and the
   *   fixture tile is deliberately (21, 23).
   */
  it("targets pac-man's tile exactly, whichever way pac-man is facing", () => {
    /* Vacuity guard: were ALL_DIRECTIONS ever empty, this loop body would never
       run and the test would report success while checking nothing. */
    expect.assertions(4);

    for (const facing of ALL_DIRECTIONS) {
      expect(blinkyTarget(BLINKY, contextFacing(facing))).toEqual(PACMAN_TILE);
    }
  });
});
