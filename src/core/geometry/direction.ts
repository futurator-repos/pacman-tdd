import { type Vector2 } from './vector.ts';

/**
 * STUB — signatures only, behaviour deliberately absent.
 *
 * This exists so the tests can RUN and fail on their assertions. A test that
 * fails with "Cannot find module" has demonstrated nothing about itself; a test
 * that fails with "expected {x:0,y:-1}, received {x:0,y:0}" has proven it is
 * actually checking something. See docs/TDD-CHARTER.md, Challenge 3, Defence B.
 */

export const Direction = {
  Up: 'up',
  Left: 'left',
  Down: 'down',
  Right: 'right',
} as const;

export type Direction = (typeof Direction)[keyof typeof Direction];

export const ALL_DIRECTIONS: readonly Direction[] = [];

export function toUnitVector(_direction: Direction): Vector2 {
  return { x: 0, y: 0 };
}

export function opposite(direction: Direction): Direction {
  return direction;
}

export function isOpposite(_a: Direction, _b: Direction): boolean {
  return false;
}
