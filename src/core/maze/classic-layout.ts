/**
 * SIGNATURE-ONLY STUB — RED phase.
 *
 * `MazeGlyph` is declared in full because it is the LEGEND — the shared
 * vocabulary the parser, the renderer-back-to-ASCII and every test fixture
 * speak. A const object of thirteen character literals asserts nothing about
 * the board.
 *
 * `CLASSIC_LAYOUT` is the CONTENT, and content is what the tests specify, so it
 * is stubbed to `[]` exactly as `ALL_DIRECTIONS` was stubbed to `[]` in the
 * geometry slice. `classic-layout.test.ts` fails on its census until the real
 * 31 rows are authored. See docs/TDD-FINDINGS.md, "the stub is a measuring
 * instrument".
 */

/**
 * The legend: one character per tile, exactly as sprites are authored as rows
 * of pixel characters in `assets/sprites/`.
 *
 * A board authored as ASCII is reviewable in a diff — a wall moved by one tile
 * is visible to a human reading the pull request, which no array of 868
 * integers ever is. That is the whole reason for this representation.
 *
 * Three groups:
 *
 *   TERRAIN   `#` wall, ` ` open floor, `-` ghost-house gate,
 *             `T` open floor inside a tunnel, `H` ghost-house interior
 *   FOOD      `.` a dot, `o` an energizer (both sit on open floor)
 *   MARKERS   `P` Pac-Man's spawn, `1`..`4` the ghost spawns in GHOST_ORDER
 *             (Blinky, Pinky, Inky, Clyde), `F` the tile the bonus fruit uses
 *
 * The four ghost markers are numbered rather than lettered because `P` is
 * already Pac-Man and Pinky/Blinky/Inky/Clyde have no distinct initials that do
 * not collide with the terrain glyphs. `1` sits on OPEN floor (Blinky starts
 * outside the house); `2`, `3` and `4` sit on HOUSE floor.
 *
 * The set is CLOSED. `parseMaze` throws on any character not listed here rather
 * than defaulting it to open floor — a typo must be a build failure, not a hole
 * in a wall that a player discovers.
 */
export const MazeGlyph = {
  Wall: '#',
  Empty: ' ',
  Door: '-',
  Tunnel: 'T',
  House: 'H',
  Pellet: '.',
  PowerPellet: 'o',
  PacmanSpawn: 'P',
  BlinkySpawn: '1',
  PinkySpawn: '2',
  InkySpawn: '3',
  ClydeSpawn: '4',
  FruitTile: 'F',
} as const;

export type MazeGlyph = (typeof MazeGlyph)[keyof typeof MazeGlyph];

/**
 * STUB — the real board is specified by `classic-layout.test.ts`.
 *
 * The original playfield: 31 rows of 28 characters, holding exactly 240 dots
 * and 4 energizers, mirror-symmetric about its vertical centre line, with one
 * tunnel row that reaches both edges of the board and one ghost house.
 */
export const CLASSIC_LAYOUT: readonly string[] = [];
