/**
 * SIGNATURE-ONLY STUB — RED phase of slice s03.
 *
 * Every function below returns a deliberately inert value and contains no
 * behaviour whatsoever. Its only job is to make `actor.test.ts` and
 * `move-actor.test.ts` EXECUTE, so they fail with a real expected-vs-received
 * diff instead of `Cannot find module` (see docs/TDD-FINDINGS.md, failure
 * mode 1). The rule that keeps the stub honest: it must not make a single
 * assertion pass that ought to be failing — which is why SUBPIXELS_PER_PIXEL
 * is 0 here and not 256.
 *
 * `Tile` and `Maze` are imported with the full `import type` form rather than
 * the house's inline `{ type X }` style. That is deliberate, and it is worth
 * knowing why: under `verbatimModuleSyntax` an inline type import still emits a
 * runtime `import {} from '...'`, whereas the full form is erased completely.
 * Those two modules belong to slices s01 and s02, which were still being
 * written when this slice's tests were — so the full form is what let these
 * tests EXECUTE and fail on their own assertions before their neighbours
 * existed, instead of failing on module resolution and proving nothing.
 */
import type { Direction } from '../geometry/direction.ts';
import type { Tile } from '../geometry/tile.ts';
import type { Vector2 } from '../geometry/vector.ts';
import type { Maze } from '../maze/maze.ts';

/**
 * Sub-pixels per whole pixel.
 *
 * Speeds are fractional; positions are not. An actor moves in whole pixels and
 * banks the fraction as an integer, so a ten-thousand-frame replay is exact
 * integer arithmetic with no float drift.
 */
export const SUBPIXELS_PER_PIXEL = 0;

/** One mover. Pac-Man and all four ghosts are this shape. */
export interface Actor {
  /** Whole-pixel centre, in arcade playfield space. */
  readonly position: Vector2;
  readonly facing: Direction;
  /** Requested but not yet legal. Retried every pixel — that is cornering. */
  readonly queued: Direction | null;
  /** Always in [0, SUBPIXELS_PER_PIXEL). */
  readonly carrySubPixels: number;
}

/** Everything a turn policy is allowed to know. */
export interface TurnContext {
  readonly actor: Actor;
  readonly tile: Tile;
  readonly atTileCentre: boolean;
  readonly maze: Maze;
  readonly mayPassDoor: boolean;
}

/**
 * Decides which way to leave. Pac-Man's policy consults the queued input; a
 * ghost's consults its target. One movement engine, two policies.
 */
export type TurnPolicy = (ctx: TurnContext) => Direction;

/** One frame of movement, asked for. */
export interface MoveRequest {
  readonly actor: Actor;
  readonly maze: Maze;
  /**
   * Whole sub-pixels of travel this frame. `speed.ts` is the one place an
   * arcade percentage becomes this integer, so the mover never sees a
   * fraction.
   */
  readonly stepSubPixels: number;
  readonly mayPassDoor: boolean;
}

/** One frame of movement, answered. */
export interface MoveResult {
  readonly actor: Actor;
  /** The tile newly entered this frame, or null. */
  readonly enteredTile: Tile | null;
  readonly blocked: boolean;
  readonly turned: boolean;
}

/** The tile an actor's centre pixel falls in. */
export function tileOf(_actor: Actor): Tile {
  return { col: 0, row: 0 };
}

/** Whether the actor stands exactly on its tile's centre pixel. */
export function isAtTileCentre(_actor: Actor): boolean {
  return false;
}
