import type { Direction } from '../geometry/direction.ts';
import type { Tile } from '../geometry/tile.ts';
import type { Vector2 } from '../geometry/vector.ts';
import type { GhostId } from '../ghost/ghost-id.ts';

import { TileKind } from './tile-kind.ts';

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
 *
 * One deliberate wrinkle, recorded so nobody "fixes" it: `kindAt` is stubbed to
 * `TileKind.Wall` because a string union has no zero value. That makes the
 * out-of-bounds HALF of `kindAt`'s test pass while the in-bounds half fails —
 * which is precisely why docs/TEST-PLAN.md puts both halves in ONE test. A test
 * fails if any assertion in it fails, so the pairing keeps the red honest.
 */

/** The arcade playfield, in tiles. STUB — pinned by `maze.test.ts`. */
export const MAZE_COLUMNS = 0;
/** STUB — pinned by `maze.test.ts`. */
export const MAZE_ROWS = 0;

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
 * STUB.
 *
 * TOTAL: every tile has an answer. Off the grid reads as `Wall`, which is also
 * the arcade's own behaviour at every board edge except the tunnel row. That
 * one decision deletes a bounds check from every caller and guarantees no
 * `undefined` ever leaks out of the flat array under `noUncheckedIndexedAccess`.
 */
export function kindAt(_maze: Maze, _tile: Tile): TileKind {
  return TileKind.Wall;
}

/**
 * STUB.
 *
 * `mayPassDoor` is the whole Pac-Man-versus-ghost asymmetry, as one parameter:
 * ghosts leave the house through the gate, Pac-Man can never enter it.
 */
export function isWalkable(_maze: Maze, _tile: Tile, _mayPassDoor: boolean): boolean {
  return false;
}

/**
 * STUB.
 *
 * Returns the legal exits from `tile` in `ALL_DIRECTIONS` order — up, left,
 * down, right. The ORDER is load-bearing: it is what resolves a ghost's
 * distance tie, so it is part of the contract and not an implementation detail.
 */
export function walkableNeighbours(
  _maze: Maze,
  _tile: Tile,
  _mayPassDoor: boolean,
): readonly WalkableNeighbour[] {
  return [];
}

/** STUB. Whether a ghost is forbidden from choosing "up" out of this tile. */
export function isNoUpTile(_maze: Maze, _tile: Tile): boolean {
  return false;
}

/**
 * STUB.
 *
 * Warps a PIXEL position horizontally, and only on the tunnel row. Gated on the
 * row rather than applied board-wide, because a board-wide wrap would silently
 * rescue genuine out-of-bounds bugs on the other thirty rows.
 */
export function wrapPosition(_maze: Maze, _position: Vector2): Vector2 {
  return { x: 0, y: 0 };
}
