import { type Maze } from '../maze/maze.ts';
import { parseMaze } from '../maze/parse-maze.ts';

/**
 * This file is production code, not a test helper hiding in `src/`. It is held
 * to the same 100% coverage bar as the rules, because a fixture that shapes
 * twenty other tests deserves to be correct — see docs/ARCHITECTURE.md,
 * "src/core/testing/ as first-class production code".
 *
 * Every layout below carries a one-tile ghost house and a `P`, because
 * `parseMaze` requires both. That is the fixtures paying the same price as real
 * authored data, which is the point: a fixture that could not be a board would
 * not be evidence about boards.
 */

/**
 * A straight horizontal corridor: every interior tile has exactly two exits,
 * left and right.
 *
 * ```
 *      col 0123456789A
 * row 0    ###########
 * row 1    ####H######
 * row 2    ####-######
 * row 3    #...P.....#
 * row 4    ###########
 * ```
 */
const CORRIDOR_LAYOUT: readonly string[] = [
  '###########',
  '####H######',
  '####-######',
  '#...P.....#',
  '###########',
];

/**
 * A four-way junction at (5,4), where all four exits are open.
 *
 * ```
 *      col 0123456789A
 * row 0    ###########
 * row 1    #####H#####
 * row 2    #####-#####
 * row 3    #####.#####
 * row 4    #....P....#
 * row 5    #####.#####
 * row 6    ###########
 * ```
 */
const CROSSROADS_LAYOUT: readonly string[] = [
  '###########',
  '#####H#####',
  '#####-#####',
  '#####.#####',
  '#....P....#',
  '#####.#####',
  '###########',
];

/**
 * A corridor that stops at (5,3), whose only exit is back the way you came.
 *
 * ```
 *      col 0123456789A
 * row 0    ###########
 * row 1    ####H######
 * row 2    ####-######
 * row 3    #...P.#####
 * row 4    ###########
 * ```
 */
const DEAD_END_LAYOUT: readonly string[] = [
  '###########',
  '####H######',
  '####-######',
  '#...P.#####',
  '###########',
];

/**
 * Build a small hand-drawn maze from ASCII rows.
 *
 * Identical in behaviour to `parseMaze`, and named differently ON PURPOSE: at a
 * call site, `tinyMaze([...])` says "this is a fixture I drew to show one
 * situation", while `parseMaze` says "this is authored game data". A system
 * test should show its own board — five rows a reader can check by eye — rather
 * than reach for the 28x31 arcade board and bury the point.
 */
export function tinyMaze(rows: readonly string[]): Maze {
  return parseMaze(rows);
}

/**
 * The corridor fixture, built fresh on each call.
 *
 * A function rather than a module constant so that a test which needs one can
 * never be handed a board another test has kept a reference to. The parse costs
 * microseconds on eleven columns, and the isolation is worth more than that.
 */
export function corridorMaze(): Maze {
  return tinyMaze(CORRIDOR_LAYOUT);
}

/**
 * The crossroads fixture — the one that makes a tie-break rule VISIBLE.
 *
 * With every direction legal out of (5,4), the answer a ghost gives is entirely
 * about the rule and not about the walls. A junction that quietly degraded to a
 * T would leave the fourth candidate untested while the test still passed,
 * which is why `tiny-maze.test.ts` pins the shape rather than trusting it.
 */
export function crossroadsMaze(): Maze {
  return tinyMaze(CROSSROADS_LAYOUT);
}

/**
 * The dead-end fixture.
 *
 * It exists to force one awkward case that no natural board reaches often: the
 * tile where a ghost's only legal move is the reversal it is normally forbidden
 * to take. Without a fixture that guarantees it, the branch that handles it is
 * never exercised and the crash it prevents stays live.
 */
export function deadEndMaze(): Maze {
  return tinyMaze(DEAD_END_LAYOUT);
}
