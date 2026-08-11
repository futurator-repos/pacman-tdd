/**
 * The food on the board, as a value separate from the board itself.
 *
 * WHY THIS IS NOT PART OF `Maze`. The maze never changes during a level; the
 * pellets change 244 times. Keeping them apart means `Maze` can be a module
 * constant parsed once, and `GameState` carries only the part that actually
 * moves.
 */
import { type Tile } from '../geometry/tile.ts';

import { type Maze } from './maze.ts';

/**
 * What is lying on a tile — nothing, a dot, or an energizer.
 *
 * Three values rather than a boolean, because the caller's next three
 * decisions all differ: 10 points versus 50 (slice s08), one freeze frame
 * versus three, and fright versus no fright
 * (docs/ARCADE-REFERENCE.md sections 6.6 and 8.2).
 *
 * A const object rather than an enum: `erasableSyntaxOnly` is on, so the type
 * layer must vanish completely at build time.
 */
export const PelletKind = {
  None: 'none',
  Pellet: 'pellet',
  PowerPellet: 'powerPellet',
} as const;

export type PelletKind = (typeof PelletKind)[keyof typeof PelletKind];

/**
 * Which tiles still hold food, and how much has been eaten.
 *
 * Two sets of FLAT ROW-MAJOR INDICES (`row * columns + col`, the same
 * arithmetic `kindAt` uses) rather than two arrays of `Tile`: membership and
 * removal are what this type is asked for 244 times a level, and a `Tile` is an
 * object so a `Set<Tile>` would compare by reference and never find anything.
 *
 * `columns` is carried so that `pelletAt` and `eatAt` are total functions of
 * the FIELD alone and no caller has to thread the maze through to ask what is
 * on a tile. docs/ARCHITECTURE.md describes this type as "two ReadonlySets of
 * tile indices plus an eaten count"; the fourth field is the one deviation, and
 * it is here because the alternative is a `maze` parameter on every accessor.
 *
 * `eaten` is stored rather than derived as `244 - remaining`, because the fruit
 * rule (70 and 170 dots eaten, slice s08) and the ghost-house dot counters
 * (slice s06) both count UP, and a board size is a property of the board rather
 * than of a running total.
 */
export interface PelletField {
  readonly columns: number;
  readonly pellets: ReadonlySet<number>;
  readonly powerPellets: ReadonlySet<number>;
  readonly eaten: number;
}

/**
 * The same `row * columns + col` arithmetic `kindAt` uses, in one place.
 *
 * Private, because the flat index is an encoding detail of this module: a
 * caller that computed it for itself would be free to compute it against a
 * DIFFERENT column count than the field carries, which is the one way this
 * representation can go wrong without anything looking wrong.
 */
function flatIndex(columns: number, tile: Tile): number {
  return tile.row * columns + tile.col;
}

/** The full board of food a level starts with, read off the maze. */
export function createPelletField(maze: Maze): PelletField {
  const toIndex = (tile: Tile): number => flatIndex(maze.columns, tile);
  return {
    columns: maze.columns,
    pellets: new Set(maze.pelletTiles.map(toIndex)),
    powerPellets: new Set(maze.powerPelletTiles.map(toIndex)),
    eaten: 0,
  };
}

/**
 * What is on `tile`. Total: an off-board tile is `None`, never a crash.
 *
 * The COLUMN is guarded and the row is not, for exactly the reason `kindAt`
 * documents: in a row-major encoding, column -1 of row 2 is a legal index — the
 * last tile of row 1 — so an actor part-way through the tunnel would eat a dot
 * from a neighbouring row, once per transit, until the board cleared itself. A
 * row outside the board simply produces an index no set holds.
 */
export function pelletAt(field: PelletField, tile: Tile): PelletKind {
  if (tile.col < 0 || tile.col >= field.columns) {
    return PelletKind.None;
  }
  const index = flatIndex(field.columns, tile);
  if (field.pellets.has(index)) {
    return PelletKind.Pellet;
  }
  if (field.powerPellets.has(index)) {
    return PelletKind.PowerPellet;
  }
  return PelletKind.None;
}

/**
 * Consume whatever is on `tile`, returning a NEW field.
 *
 * A no-op on a tile with nothing on it — and it returns the SAME REFERENCE in
 * that case, so a caller may eat unconditionally with no guard of its own.
 *
 * The copy is not an optimisation to be tidied away later: `PelletField` lives
 * inside `GameState`, and a `Set.delete` here would edit a value some other test
 * is holding as its "before", making that test compare a value with itself.
 * Only the set that actually changed is copied, because the other one is already
 * an immutable value and sharing it is free.
 */
export function eatAt(field: PelletField, tile: Tile): PelletField {
  const kind = pelletAt(field, tile);
  if (kind === PelletKind.None) {
    return field;
  }
  const index = flatIndex(field.columns, tile);
  if (kind === PelletKind.Pellet) {
    const pellets = new Set(field.pellets);
    pellets.delete(index);
    return { ...field, pellets, eaten: field.eaten + 1 };
  }
  const powerPellets = new Set(field.powerPellets);
  powerPellets.delete(index);
  return { ...field, powerPellets, eaten: field.eaten + 1 };
}

/** Dots plus energizers still on the board. */
export function remaining(field: PelletField): number {
  return field.pellets.size + field.powerPellets.size;
}

/**
 * Whether the level's board is finished.
 *
 * Asked of `remaining`, which spans BOTH sets, so 240 dots eaten with one
 * energizer still blinking is not a cleared board — the level advancing there
 * would cost the player the last fright of every level and the ghost points
 * that go with it (docs/ARCADE-REFERENCE.md section 8.1).
 *
 * A free function, not a method: `PelletField` lives inside `GameState`, which
 * slice s09 requires to survive `structuredClone` and a JSON round trip. A
 * method would not survive either.
 */
export function isCleared(field: PelletField): boolean {
  return remaining(field) === 0;
}
