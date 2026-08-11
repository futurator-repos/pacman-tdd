/**
 * The food on the board, as a value separate from the board itself.
 *
 * SIGNATURE-ONLY STUB — slice s07 RED phase. Every function below returns an
 * inert value and contains no behaviour. It exists so the tests EXECUTE and
 * fail on their assertions rather than on "Cannot find module", which is the
 * only kind of red that proves anything (docs/TDD-CHARTER.md, challenge 1).
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

/** The full board of food a level starts with, read off the maze. */
export function createPelletField(_maze: Maze): PelletField {
  return {
    columns: 0,
    pellets: new Set<number>(),
    powerPellets: new Set<number>(),
    eaten: 0,
  };
}

/** What is on `tile`. Total: an off-board tile is `None`, never a crash. */
export function pelletAt(_field: PelletField, _tile: Tile): PelletKind {
  return PelletKind.None;
}

/**
 * Consume whatever is on `tile`, returning a NEW field.
 *
 * A no-op on a tile with nothing on it — and it returns the SAME REFERENCE in
 * that case, so a caller may eat unconditionally with no guard of its own.
 */
export function eatAt(field: PelletField, _tile: Tile): PelletField {
  return field;
}

/** Dots plus energizers still on the board. */
export function remaining(_field: PelletField): number {
  return 0;
}

/**
 * Whether the level's board is finished.
 *
 * A free function, not a method: `PelletField` lives inside `GameState`, which
 * slice s09 requires to survive `structuredClone` and a JSON round trip. A
 * method would not survive either.
 */
export function isCleared(_field: PelletField): boolean {
  return false;
}
