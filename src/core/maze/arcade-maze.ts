import { CLASSIC_LAYOUT, CLASSIC_NO_UP_TILES } from './classic-layout.ts';
import { type Maze } from './maze.ts';
import { parseMaze } from './parse-maze.ts';

/** The terrain, food and markers the ASCII can express. */
const PARSED_LAYOUT = parseMaze(CLASSIC_LAYOUT);

/**
 * The classic board, assembled ONCE at module load.
 *
 * Parsing is pure and the result is deeply immutable, so building it once is
 * safe and means the 868-tile parse does not happen sixty times a second. It
 * also gives every consumer the same OBJECT, which is what lets a later test
 * compare mazes with `toBe`.
 *
 * The no-up tiles are applied here rather than inside `parseMaze` because they
 * are the one property of this board that the ASCII cannot express: a ROM quirk
 * about turning, not a fact about walls (see `CLASSIC_NO_UP_TILES`). Composing
 * them at the one place the classic board is built keeps `parseMaze` honest for
 * hand-drawn fixtures, which get no no-up tiles at all.
 */
export const ARCADE_MAZE: Maze = {
  ...PARSED_LAYOUT,
  noUpTiles: new Set(
    CLASSIC_NO_UP_TILES.map((tile) => tile.row * PARSED_LAYOUT.columns + tile.col),
  ),
};

/**
 * The one maze lookup in the game.
 *
 * `tick` and `buildScene` both call this, which is what makes it impossible for
 * the rules and the picture to disagree about which board is on screen. The
 * original arcade alternates two mazes from level 21; the second maze is out of
 * scope (docs/ARCHITECTURE.md, "scope exclusions"), so every level resolves to
 * the same board — and that fact lives HERE, behind one function, rather than
 * being assumed at a dozen call sites. The day a second maze arrives, this
 * function is the only thing that changes.
 */
export function mazeForLevel(_level: number): Maze {
  return ARCADE_MAZE;
}
