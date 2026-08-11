import { ALL_DIRECTIONS, type Direction } from '../geometry/direction.ts';
import { TILE_SIZE, type Tile, neighbour, tileAt } from '../geometry/tile.ts';
import type { Vector2 } from '../geometry/vector.ts';
import type { GhostId } from '../ghost/ghost-id.ts';

import { TileKind } from './tile-kind.ts';

/**
 * The arcade playfield, in tiles.
 *
 * Exported as constants rather than read off `ARCADE_MAZE.columns` so that a
 * consumer which only needs the SIZE — the renderer's layout maths, a test
 * building a fixture — does not have to parse an 868-tile board to learn it.
 * `classic-layout.test.ts` pins the authored ASCII to the same two numbers
 * independently, which is what stops the pair from drifting apart.
 */
export const MAZE_COLUMNS = 28;
/** See `MAZE_COLUMNS`. Thirty-one rows of playfield, below the arcade's HUD. */
export const MAZE_ROWS = 31;

/**
 * The board: static data with total accessors.
 *
 * Deliberately NOT part of `GameState`. The maze never changes during a level,
 * so keeping it out of state means a failing assertion prints a state you can
 * actually read instead of 868 tiles of noise; `mazeForLevel(state.level)` is
 * the one lookup that both `tick` and `buildScene` use, so the rules and the
 * picture can never disagree about which board is on screen.
 */
export interface Maze {
  readonly columns: number;
  readonly rows: number;
  /**
   * Row-major, length `columns * rows`. Flat rather than nested, because index
   * arithmetic is cheaper to test than a jagged array of arrays — and because a
   * flat array has exactly one way to be wrong, which one test can pin.
   */
  readonly tiles: readonly TileKind[];
  readonly pelletTiles: readonly Tile[];
  readonly powerPelletTiles: readonly Tile[];
  /**
   * Flat indices (`row * columns + col`) of the four tiles where a ghost may
   * not choose to turn upward. A hardware quirk of the original board, so it
   * is DATA the maze carries rather than an `if` buried in the ghost AI.
   */
  readonly noUpTiles: ReadonlySet<number>;
  readonly pacmanSpawn: Tile;
  readonly ghostSpawns: Readonly<Record<GhostId, Tile>>;
  /**
   * The four fixed corners each ghost retreats to during scatter. They live on
   * the maze because they are properties of the BOARD, which is what keeps
   * ghost targeting a pure function of position and mode. Their coordinates are
   * pinned in `src/core/ghost/targeting/scatter-corners.test.ts`, next to the
   * rule that consumes them — deliberately not here.
   */
  readonly scatterTargets: Readonly<Record<GhostId, Tile>>;
  readonly houseDoorTile: Tile;
  readonly houseCentreTile: Tile;
  readonly fruitTile: Tile;
  /** The one row the tunnel wraps on, or -1 for a board with no tunnel. */
  readonly tunnelRow: number;
}

/**
 * One legal move out of a tile: which way, and where it lands.
 *
 * Both halves are returned together because every caller needs both — the ghost
 * tie-break compares the TILES by distance and then reports the DIRECTION — and
 * recomputing one from the other at each call site is how the two drift apart.
 */
export interface WalkableNeighbour {
  readonly direction: Direction;
  readonly tile: Tile;
}

/**
 * TOTAL: every tile has an answer. Off the grid reads as `Wall`, which is also
 * the arcade's own behaviour at every board edge except the tunnel row. That
 * one decision deletes a bounds check from every caller and guarantees no
 * `undefined` ever leaks out of the flat array under `noUncheckedIndexedAccess`.
 *
 * Note the asymmetry in HOW the two axes are checked, which is deliberate and
 * not an oversight. The COLUMN needs an explicit guard: with a flat row-major
 * array, column -1 of row 2 is a perfectly valid index — it is the last tile of
 * row 1 — so without the guard a tile off the left edge would silently read as
 * the far right of the row above. The ROW needs no guard at all, because any row
 * outside the board lands outside the array entirely, and `undefined` is exactly
 * the signal we already have to turn into `Wall`.
 */
export function kindAt(maze: Maze, tile: Tile): TileKind {
  if (tile.col < 0 || tile.col >= maze.columns) {
    return TileKind.Wall;
  }
  return maze.tiles[tile.row * maze.columns + tile.col] ?? TileKind.Wall;
}

/**
 * `mayPassDoor` is the whole Pac-Man-versus-ghost asymmetry, as one parameter:
 * ghosts leave the house through the gate, Pac-Man can never enter it.
 *
 * Everything that is not a wall and not the gate is walkable, stated that way
 * round on purpose. A tunnel tile is ordinary floor — the ghost slowdown there
 * is a SPEED rule and lives in `ghost-speed.ts` — and a house tile is
 * occupiable, or three ghosts could not wait inside it.
 */
export function isWalkable(maze: Maze, tile: Tile, mayPassDoor: boolean): boolean {
  const kind = kindAt(maze, tile);
  if (kind === TileKind.Door) {
    return mayPassDoor;
  }
  return kind !== TileKind.Wall;
}

/**
 * The legal exits from `tile`, in `ALL_DIRECTIONS` order — up, left, down,
 * right.
 *
 * The ORDER is load-bearing and therefore part of the contract, not an
 * implementation detail: when two candidate tiles are exactly equidistant from
 * a ghost's target, the arcade takes the earlier direction in that sequence. A
 * tie-break rule is only meaningful if the candidates arrive in the order it
 * assumes, so this function iterates `ALL_DIRECTIONS` itself rather than
 * leaving each caller to sort.
 */
export function walkableNeighbours(
  maze: Maze,
  tile: Tile,
  mayPassDoor: boolean,
): readonly WalkableNeighbour[] {
  const exits: WalkableNeighbour[] = [];
  for (const direction of ALL_DIRECTIONS) {
    const next = neighbour(tile, direction);
    if (isWalkable(maze, next, mayPassDoor)) {
      exits.push({ direction, tile: next });
    }
  }
  return exits;
}

/**
 * Whether a ghost is forbidden from choosing "up" out of this tile.
 *
 * A membership test against the flat indices the maze already carries, so the
 * quirk stays data. The ghost AI asks this question; it never holds the list,
 * which is what lets a test hand `choose-direction` a board with no no-up tiles
 * at all and observe the rule in isolation.
 */
export function isNoUpTile(maze: Maze, tile: Tile): boolean {
  return maze.noUpTiles.has(tile.row * maze.columns + tile.col);
}

/**
 * Warps a PIXEL position horizontally, and only on the tunnel row.
 *
 * Gated on the row rather than applied board-wide, because a board-wide wrap
 * would silently rescue genuine out-of-bounds bugs on the other thirty rows —
 * an actor that escaped through a wall would reappear on the far side instead
 * of failing a test.
 *
 * The double modulo is what makes this a total function rather than one that
 * happens to work for a one-pixel overshoot: `%` keeps the sign of its left
 * operand in JavaScript, so a single `% width` maps -1 to -1. Adding `width`
 * and taking the modulo again lands ANY x on the board in one application,
 * which is the idempotence the property test in `maze.test.ts` asserts.
 */
export function wrapPosition(maze: Maze, position: Vector2): Vector2 {
  if (tileAt(position).row !== maze.tunnelRow) {
    return position;
  }
  const width = maze.columns * TILE_SIZE;
  return { x: ((position.x % width) + width) % width, y: position.y };
}
