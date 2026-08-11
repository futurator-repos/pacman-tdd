import { GhostId } from '../ghost/ghost-id.ts';

import { type Maze } from './maze.ts';

/**
 * SIGNATURE-ONLY STUB — RED phase.
 *
 * Both functions declare their real types and return deliberately inert values.
 * `parseMaze` throws nothing at all, which is what makes all four
 * loud-failure tests in `parse-maze.test.ts` fail honestly rather than pass by
 * accident. See docs/TDD-FINDINGS.md, "the stub is a measuring instrument".
 */

/**
 * The inert board the stub hands back. Zero columns, zero rows, no tiles.
 *
 * Deliberately NOT a plausible maze: a 28x31 placeholder here would make
 * several assertions in `arcade-maze.test.ts` pass against a parser that does
 * nothing, which is exactly the fake red the charter forbids.
 */
const EMPTY_MAZE: Maze = {
  columns: 0,
  rows: 0,
  tiles: [],
  pelletTiles: [],
  powerPelletTiles: [],
  noUpTiles: new Set<number>(),
  pacmanSpawn: { col: 0, row: 0 },
  ghostSpawns: {
    [GhostId.Blinky]: { col: 0, row: 0 },
    [GhostId.Pinky]: { col: 0, row: 0 },
    [GhostId.Inky]: { col: 0, row: 0 },
    [GhostId.Clyde]: { col: 0, row: 0 },
  },
  scatterTargets: {
    [GhostId.Blinky]: { col: 0, row: 0 },
    [GhostId.Pinky]: { col: 0, row: 0 },
    [GhostId.Inky]: { col: 0, row: 0 },
    [GhostId.Clyde]: { col: 0, row: 0 },
  },
  houseDoorTile: { col: 0, row: 0 },
  houseCentreTile: { col: 0, row: 0 },
  fruitTile: { col: 0, row: 0 },
  tunnelRow: -1,
};

/**
 * STUB — the contract below is what `parse-maze.test.ts` specifies.
 *
 * Turns authored ASCII into a `Maze`, or throws. It never returns a
 * half-built board: authored data is validated once, at construction, exactly
 * as `validateSprite` validates a sprite and `load-atlas` validates a manifest.
 *
 * VALIDATION ORDER, because the error message a human sees depends on it:
 *
 *   1. SHAPE   — row 0 declares the width; any later row of a different length
 *                throws, naming the row index and both widths.
 *   2. GLYPHS  — any character outside `MazeGlyph` throws, naming the row, the
 *                column and the offending character.
 *   3. DOOR    — a board with no `-` throws. A maze without a gate can never
 *                release a ghost, and a door silently defaulted to (0,0) puts
 *                every ghost's exit target in a corner wall.
 *   4. SPAWN   — a board with no `P` throws, for the same reason: `startGame`
 *                places Pac-Man there with no fallback.
 *
 * All indices in every message are ZERO-BASED, matching `Tile.col`/`Tile.row`,
 * so a reported coordinate can be pasted straight into a test. The four
 * messages are worded exactly like this, and `parse-maze.test.ts` asserts on
 * the parts that carry the information:
 *
 *   `maze row 2 has 2 columns, expected 28`
 *   `maze row 1, column 2: unknown glyph 'X'`
 *   `maze has no ghost-house door: expected at least one '-' tile`
 *   `maze has no Pac-Man spawn: expected exactly one 'P' tile`
 *
 * A message that names neither the row nor the character is a message that
 * sends a human back to counting 868 characters by hand.
 *
 * DELIBERATE DEFAULTS, so a five-by-five fixture stays readable. Absent
 * markers do not throw:
 *
 *   - a ghost spawn `1`..`4` falls back to `houseCentreTile`
 *   - `F` falls back to `pacmanSpawn`
 *   - no `T` anywhere means `tunnelRow` is -1 and `wrapPosition` never warps
 *   - `houseDoorTile` is the FIRST `-` in row-major order
 *   - `houseCentreTile` is the floor-midpoint of the bounding box of the house
 *     tiles, or `houseDoorTile` when the board draws no house
 *   - `scatterTargets` are the board's four outside corners, derived from
 *     `columns` and `rows`: Blinky (columns-3, 0), Pinky (2, 0),
 *     Inky (columns-1, rows-1), Clyde (0, rows-1)
 *
 * Only the two fields whose absence would break the game outright — the gate a
 * ghost leaves by, and the tile Pac-Man starts on — are required.
 *
 * NOTE, against docs/ARCHITECTURE.md: that document also lists "the wrong
 * pellet counts" as a parse failure. It cannot be, or every three-by-three
 * fixture would be rejected. The 240/4 census belongs to the authored board,
 * not to the parser, and it is pinned by `classic-layout.test.ts` and by the
 * flood fill in `arcade-maze.test.ts`. Recorded here as a decision rather than
 * left as an omission.
 */
export function parseMaze(_rows: readonly string[]): Maze {
  return EMPTY_MAZE;
}

/**
 * STUB.
 *
 * The inverse of `parseMaze`: a `Maze` rendered back to the ASCII it was
 * authored as. This exists so the parser can be checked by a ROUND TRIP rather
 * than by a snapshot — a snapshot of the tile grid would have no oracle at all,
 * since whatever the parser produced on day one would become the expected value
 * forever. Here the authored layout IS the oracle.
 *
 * PRECEDENCE, first match wins, so that every tile has exactly one glyph:
 *
 *   1. `pacmanSpawn`                              -> `P`
 *   2. `ghostSpawns` blinky/pinky/inky/clyde      -> `1` / `2` / `3` / `4`
 *   3. `fruitTile`                                -> `F`
 *   4. a tile in `powerPelletTiles`               -> `o`
 *   5. a tile in `pelletTiles`                    -> `.`
 *   6. otherwise its `TileKind`  -> `#` / `-` / `T` / `H` / ` `
 *
 * `houseDoorTile` and `houseCentreTile` need no glyph of their own: the door is
 * recovered from its `Door` kind, and the house centre is Pinky's spawn.
 */
export function renderMaze(_maze: Maze): readonly string[] {
  return [];
}
