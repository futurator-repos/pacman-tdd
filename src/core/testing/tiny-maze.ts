import { type Maze } from '../maze/maze.ts';
import { parseMaze } from '../maze/parse-maze.ts';

/**
 * SIGNATURE-ONLY STUB — RED phase.
 *
 * Every function returns the same inert board so that `tiny-maze.test.ts` and
 * every test that borrows a fixture fails on its own assertions rather than on
 * `Cannot find module`. The three fixture layouts are CONTENT — they are
 * specified by the tests, and drawn in the doc comments below so the GREEN step
 * has no room to invent a different shape.
 *
 * This file is production code, not a test helper hiding in `src/`. It is held
 * to the same 100% coverage bar as the rules, because a fixture that shapes
 * twenty other tests deserves to be correct — see docs/ARCHITECTURE.md,
 * "src/core/testing/ as first-class production code".
 */

const EMPTY_LAYOUT: readonly string[] = [];

/**
 * Build a small hand-drawn maze from ASCII rows.
 *
 * Identical in behaviour to `parseMaze`, and named differently ON PURPOSE: at a
 * call site, `tinyMaze([...])` says "this is a fixture I drew to show one
 * situation", while `parseMaze` says "this is authored game data". A system
 * test should show its own board — five rows a reader can check by eye — rather
 * than reach for the 28x31 arcade board and bury the point.
 *
 * Fixtures must still satisfy `parseMaze`: every one needs a `-` gate and a `P`
 * spawn, which is why each layout below carries a one-tile ghost house.
 */
export function tinyMaze(_rows: readonly string[]): Maze {
  return parseMaze(EMPTY_LAYOUT);
}

/**
 * STUB — layout specified by `tiny-maze.test.ts`.
 *
 * A straight horizontal corridor: every interior tile has exactly two exits,
 * left and right.
 *
 * ```
 * ###########
 * ####H######
 * ####-######
 * #...P.....#
 * ###########
 * ```
 */
export function corridorMaze(): Maze {
  return tinyMaze(EMPTY_LAYOUT);
}

/**
 * STUB — layout specified by `tiny-maze.test.ts`.
 *
 * A four-way junction at (5,4), where all four exits are open. This is the
 * fixture that makes a tie-break rule visible: with every direction legal, the
 * answer a ghost gives is entirely about the rule and not about the walls.
 *
 * ```
 * ###########
 * #####H#####
 * #####-#####
 * #####.#####
 * #....P....#
 * #####.#####
 * ###########
 * ```
 */
export function crossroadsMaze(): Maze {
  return tinyMaze(EMPTY_LAYOUT);
}

/**
 * STUB — layout specified by `tiny-maze.test.ts`.
 *
 * A corridor that stops at (5,3), whose only exit is back the way you came.
 * The fixture that forces the "a reversal is taken rather than throwing" case.
 *
 * ```
 * ###########
 * ####H######
 * ####-######
 * #...P.#####
 * ###########
 * ```
 */
export function deadEndMaze(): Maze {
  return tinyMaze(EMPTY_LAYOUT);
}
