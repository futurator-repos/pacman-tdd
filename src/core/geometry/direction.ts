import { type Vector2 } from './vector.ts';

/**
 * The four directions an actor can face.
 *
 * A const object rather than an enum: `erasableSyntaxOnly` is on, so the type
 * layer must vanish completely at build time with no runtime construct left
 * behind. The companion type declaration gives the same ergonomics as an enum.
 */
export const Direction = {
  Up: 'up',
  Left: 'left',
  Down: 'down',
  Right: 'right',
} as const;

export type Direction = (typeof Direction)[keyof typeof Direction];

/**
 * Ordered up, left, down, right — and the order is load-bearing.
 *
 * When two candidate tiles are equidistant from a ghost's target, the arcade
 * resolves the tie by preferring the earlier direction in exactly this
 * sequence. Right is therefore never preferred in a tie. Reordering this array
 * would silently change ghost pathing, which is why a test pins it.
 */
export const ALL_DIRECTIONS: readonly Direction[] = [
  Direction.Up,
  Direction.Left,
  Direction.Down,
  Direction.Right,
];

/**
 * Screen coordinates: y grows downward, so "up" is negative y.
 */
const UNIT_VECTORS: Readonly<Record<Direction, Vector2>> = {
  [Direction.Up]: { x: 0, y: -1 },
  [Direction.Left]: { x: -1, y: 0 },
  [Direction.Down]: { x: 0, y: 1 },
  [Direction.Right]: { x: 1, y: 0 },
};

const OPPOSITES: Readonly<Record<Direction, Direction>> = {
  [Direction.Up]: Direction.Down,
  [Direction.Left]: Direction.Right,
  [Direction.Down]: Direction.Up,
  [Direction.Right]: Direction.Left,
};

/** The one-tile step taken by moving in `direction`. */
export function toUnitVector(direction: Direction): Vector2 {
  return UNIT_VECTORS[direction];
}

/** The reverse of `direction`. Its own inverse, and never its own input. */
export function opposite(direction: Direction): Direction {
  return OPPOSITES[direction];
}

/**
 * Whether `b` is a reversal of `a`.
 *
 * Ghosts may not reverse direction while travelling a corridor; a reversal
 * happens only when the global mode flips between scatter and chase. This
 * predicate is what that rule will be expressed in terms of.
 */
export function isOpposite(a: Direction, b: Direction): boolean {
  return OPPOSITES[a] === b;
}
