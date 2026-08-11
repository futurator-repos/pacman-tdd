import { CLASSIC_LAYOUT } from './classic-layout.ts';
import { type Maze } from './maze.ts';
import { parseMaze } from './parse-maze.ts';

/**
 * SIGNATURE-ONLY STUB — RED phase.
 *
 * Nothing here is stubbed directly: both exports are already written the way
 * they will stay, because there is no behaviour in them to specify. They are
 * inert only because everything BELOW them is stubbed — `CLASSIC_LAYOUT` is `[]`
 * and `parseMaze` returns an empty board, so `ARCADE_MAZE` is empty too and
 * `arcade-maze.test.ts` fails on real expected-vs-received diffs.
 *
 * That is worth stating plainly rather than dressing up: the honest red for
 * this file is inherited from its dependencies.
 */

/**
 * The classic board, parsed ONCE at module load.
 *
 * Parsing is pure and the result is deeply immutable, so building it once is
 * safe and means the 868-tile parse does not happen sixty times a second.
 */
export const ARCADE_MAZE: Maze = parseMaze(CLASSIC_LAYOUT);

/**
 * The one maze lookup in the game.
 *
 * `tick` and `buildScene` both call this, which is what makes it impossible for
 * the rules and the picture to disagree about which board is on screen. The
 * original arcade alternates two mazes from level 21; the second maze is out of
 * scope (docs/ARCHITECTURE.md, "scope exclusions"), so every level resolves to
 * the same board — and that fact lives HERE, behind one function, rather than
 * being assumed at a dozen call sites.
 */
export function mazeForLevel(_level: number): Maze {
  return ARCADE_MAZE;
}
