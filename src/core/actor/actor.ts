/**
 * The Actor record, and the two questions every mover asks about itself.
 *
 * All five movers — Pac-Man and the four ghosts — are this one shape, so wall
 * collision, cornering, the tunnel wrap and the sub-pixel carry are written
 * once in `move-actor.ts` and never duplicated per character. What varies
 * between them is a `TurnPolicy`, not a movement engine.
 *
 * The two predicates live here rather than in `maze/` because an actor can
 * answer both from its own position alone: knowing WHERE you are does not
 * require knowing what is around you, and keeping that boundary means the turn
 * decision is the only place the maze is consulted at all.
 */
import { type Direction } from '../geometry/direction.ts';
import { type Tile, centreOf, tileAt } from '../geometry/tile.ts';
import { type Vector2 } from '../geometry/vector.ts';
import { type Maze } from '../maze/maze.ts';

/**
 * Sub-pixels per whole pixel.
 *
 * Speeds are fractional; positions are not. An actor moves in whole pixels and
 * banks the fraction as an integer, so a ten-thousand-frame replay is exact
 * integer arithmetic with no float drift. 256 is chosen rather than 100 because
 * it is a power of two: splitting a running total into whole pixels plus a
 * remainder is then exact in any integer representation, and every arcade speed
 * fraction keeps its own distinct step instead of collapsing onto a
 * two-decimal grid.
 */
export const SUBPIXELS_PER_PIXEL = 256;

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

/**
 * Everything a turn policy is allowed to know.
 *
 * Deliberately a closed list: a policy that cannot see the pellets, the score
 * or the other ghosts cannot accidentally depend on them, so Pac-Man's cornering
 * and a ghost's targeting stay testable as pure functions of a position and a
 * board.
 */
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
  /**
   * The tile newly entered this frame, or null. This single field is the entire
   * channel through which eating happens: a caller learns a pellet might have
   * been consumed without `moveActor` ever knowing that pellets exist.
   */
  readonly enteredTile: Tile | null;
  readonly blocked: boolean;
  readonly turned: boolean;
}

/**
 * The tile an actor's centre pixel falls in.
 *
 * A named function rather than an inlined `tileAt(actor.position)` at each call
 * site, because "which tile is this actor on" is asked by collision, by eating,
 * by targeting and by the mover itself — and one of those call sites getting the
 * conversion wrong is precisely the bug the separate `Tile` type exists to
 * prevent.
 */
export function tileOf(actor: Actor): Tile {
  return tileAt(actor.position);
}

/**
 * Whether the actor stands exactly on its tile's centre pixel.
 *
 * Exact, with no tolerance, and that is the behaviour rather than an
 * implementation detail: the arcade takes every direction decision on one
 * specific pixel. A plus-or-minus-one window would let a ghost re-decide on
 * three consecutive pixels and reverse into itself at a junction.
 *
 * Compared against `centreOf(tileOf(...))` rather than written as
 * `x % 8 === 4`: JavaScript's `%` keeps the sign of its left operand, so the
 * modulo form answers wrongly for an actor part-way out of the left tunnel
 * mouth, where x is legitimately negative.
 */
export function isAtTileCentre(actor: Actor): boolean {
  const centre = centreOf(tileOf(actor));
  return actor.position.x === centre.x && actor.position.y === centre.y;
}
