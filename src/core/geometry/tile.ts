import { type Direction } from './direction.ts';
import { type Vector2 } from './vector.ts';

/**
 * SIGNATURE-ONLY STUB — RED phase.
 *
 * Every function here declares its real type and returns a deliberately inert
 * value. There is no behaviour, on purpose: the tests must fail on their own
 * assertions with a real expected-vs-received diff, not on `Cannot find
 * module`. See docs/TDD-FINDINGS.md, "the stub is a measuring instrument".
 *
 * The rule that keeps this honest: the stub must not make a single assertion
 * pass that ought to be failing.
 */

/**
 * A position on the maze grid, in whole tiles.
 *
 * Deliberately NOT a `Vector2`. The maze is 28x31 tiles and 224x248 pixels, so
 * the two coordinate spaces differ by a factor of eight — and mixing them is
 * the single most common bug in a tile-based game. `{col, row}` versus
 * `{x, y}` makes the mix-up a compile error instead of a ghost that walks
 * through walls. `tile.test.ts` pins that with a `@ts-expect-error`.
 */
export interface Tile {
  readonly col: number;
  readonly row: number;
}

/** The width and height of one maze tile, in arcade pixels. */
export const TILE_SIZE = 0;

/** The tile containing a pixel position. Total: every pixel is in some tile. */
export function tileAt(_position: Vector2): Tile {
  return { col: 0, row: 0 };
}

/** The pixel at the exact centre of a tile. */
export function centreOf(_tile: Tile): Vector2 {
  return { x: 0, y: 0 };
}

/** Structural equality: a Tile is a value, not an identity. */
export function tileEquals(_a: Tile, _b: Tile): boolean {
  return false;
}

/** The tile one step away in `direction`. */
export function neighbour(_tile: Tile, _direction: Direction): Tile {
  return { col: 0, row: 0 };
}
