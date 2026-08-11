import { type Tile } from '../geometry/tile.ts';

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
 * The original playfield: 31 rows of 28 characters.
 *
 * Authored as a block of ASCII so that the board is REVIEWABLE — a wall moved by
 * one tile shows up in a diff as a character a human can see, which no array of
 * 868 integers ever does. The invariants a reader can check by eye, and that
 * `classic-layout.test.ts` checks mechanically, are: exactly 240 dots and 4
 * energizers, mirror symmetry about the vertical centre line, one tunnel row
 * open at both edges, and one ghost house.
 *
 * Two places deserve a second look, because they are the ones that look like
 * mistakes:
 *
 *   - Row 14 begins and ends in `T`, not `#`. The tunnel row is the only row
 *     with no wall at either edge; that is what `wrapPosition` warps across.
 *   - The corridors around the ghost house (rows 9-19, columns 9 and 18, and
 *     the approach columns 12 and 15) carry NO dots. That is arcade-accurate:
 *     they are ghost routes, and dots there would make the board unclearable
 *     without walking into the house.
 */
export const CLASSIC_LAYOUT: readonly string[] = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '######.##### ## #####.######',
  '######.##    1     ##.######',
  '######.## ###--### ##.######',
  '######.## #HHHHHH# ##.######',
  'TTTTTT.   #3H2H4H#   .TTTTTT',
  '######.## #HHHHHH# ##.######',
  '######.## ######## ##.######',
  '######.##    F     ##.######',
  '######.## ######## ##.######',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......P .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

/**
 * The four tiles where the original hardware forbids a ghost from turning up.
 *
 * Authored here, beside the board, rather than derived by `parseMaze`, because
 * there is nothing in the ASCII to derive them FROM. They are a quirk of the
 * 1980 ROM's turn table, not a consequence of the walls — two of them
 * ((12,23) and (15,23)) sit on ordinary dot tiles that look exactly like their
 * neighbours. Any rule that reproduced these four from the geometry would be
 * arithmetic reverse-engineered to fit, and it would invent phantom no-up tiles
 * on every hand-drawn test fixture.
 *
 * So they are DATA, exactly as docs/ARCHITECTURE.md says: a list of four
 * coordinates a reader can check against docs/ARCADE-REFERENCE.md, applied to
 * the board in `arcade-maze.ts`. `parseMaze` leaves `noUpTiles` empty, which is
 * what keeps a five-by-five fixture free of surprises.
 */
export const CLASSIC_NO_UP_TILES: readonly Tile[] = [
  { col: 12, row: 11 },
  { col: 15, row: 11 },
  { col: 12, row: 23 },
  { col: 15, row: 23 },
];
