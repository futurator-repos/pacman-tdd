import { Direction } from './direction.ts';
import { type Vector2 } from './vector.ts';

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

/**
 * The width and height of one maze tile, in arcade pixels.
 *
 * Eight, not sixteen. Actors are drawn as 16x16 sprites, which is a tempting
 * wrong answer: the board itself is a grid of 8x8 tiles, and core works in
 * those true arcade units so the published speed, wave and fright tables drop
 * in with no conversion factor to get wrong.
 */
export const TILE_SIZE = 8;

/** Half a tile — the offset from a tile's top-left corner to its centre. */
const HALF_TILE = TILE_SIZE / 2;

/**
 * The tile-space step taken by moving one tile in each direction.
 *
 * A total `Record` rather than a `switch`, for the same reason `direction.ts`
 * uses one: a lookup over a finite union cannot fall through to a default that
 * no test reaches, so there is no unreachable branch to explain away. Rows
 * follow the screen convention already pinned in `direction.test.ts` — y grows
 * downward, so "up" DECREASES the row.
 */
const TILE_STEPS: Readonly<Record<Direction, Tile>> = {
  [Direction.Up]: { col: 0, row: -1 },
  [Direction.Left]: { col: -1, row: 0 },
  [Direction.Down]: { col: 0, row: 1 },
  [Direction.Right]: { col: 1, row: 0 },
};

/**
 * The tile containing a pixel position. Total: every pixel is in some tile.
 *
 * Floors rather than truncates, and the difference only shows left of and above
 * the board — where an actor legitimately is, mid-way through the tunnel. With
 * truncation x=-1 and x=+1 would collapse into the same column, so a tunnelling
 * actor would read as standing on the board's edge wall and never wrap.
 */
export function tileAt(position: Vector2): Tile {
  return {
    col: Math.floor(position.x / TILE_SIZE),
    row: Math.floor(position.y / TILE_SIZE),
  };
}

/**
 * The pixel at the exact centre of a tile.
 *
 * The half-tile offset is what makes an actor sit in the middle of a corridor
 * rather than against its wall, and it is what `isAtTileCentre` — and therefore
 * every turn decision in the game — compares against.
 */
export function centreOf(tile: Tile): Vector2 {
  return {
    x: tile.col * TILE_SIZE + HALF_TILE,
    y: tile.row * TILE_SIZE + HALF_TILE,
  };
}

/**
 * Structural equality: a Tile is a value, not an identity.
 *
 * Written out rather than left to `===` at the call sites, because a tile
 * computed by ghost targeting is never the same OBJECT as one computed by
 * movement — a reference comparison would compile, read correctly, and make
 * collision fire never.
 */
export function tileEquals(a: Tile, b: Tile): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * The tile one step away in `direction`.
 *
 * Deliberately unclamped: Inky's target may legally land off the board, and
 * `kindAt` answers Wall for anything out of bounds, so clamping here would only
 * hide the arcade's own behaviour behind a second opinion.
 */
export function neighbour(tile: Tile, direction: Direction): Tile {
  const step = TILE_STEPS[direction];
  return { col: tile.col + step.col, row: tile.row + step.row };
}
