import { describe, expect, it } from 'vitest';

import { Direction, ALL_DIRECTIONS, opposite, toUnitVector, isOpposite } from './direction.ts';

/**
 * Screen coordinates: x grows right, y grows DOWN. This is the convention the
 * canvas uses, and getting it backwards is the classic source of "the ghost
 * chases upward when it should chase down" bugs — so it is pinned by a test.
 */
describe('Direction', () => {
  describe('toUnitVector', () => {
    it('maps up to negative y, because screen y grows downward', () => {
      expect(toUnitVector(Direction.Up)).toEqual({ x: 0, y: -1 });
    });

    it('maps down to positive y', () => {
      expect(toUnitVector(Direction.Down)).toEqual({ x: 0, y: 1 });
    });

    it('maps left to negative x', () => {
      expect(toUnitVector(Direction.Left)).toEqual({ x: -1, y: 0 });
    });

    it('maps right to positive x', () => {
      expect(toUnitVector(Direction.Right)).toEqual({ x: 1, y: 0 });
    });

    it('returns unit vectors for every direction', () => {
      /**
       * expect.assertions() guards against vacuous truth: if ALL_DIRECTIONS
       * were empty the loop body would never run and this test would pass
       * while checking nothing. Asserting the count makes that impossible.
       */
      expect.assertions(4);
      for (const direction of ALL_DIRECTIONS) {
        const { x, y } = toUnitVector(direction);
        expect(Math.abs(x) + Math.abs(y)).toBe(1);
      }
    });
  });

  describe('opposite', () => {
    it('reverses up to down', () => {
      expect(opposite(Direction.Up)).toBe(Direction.Down);
    });

    it('reverses left to right', () => {
      expect(opposite(Direction.Left)).toBe(Direction.Right);
    });

    it('is its own inverse for every direction', () => {
      expect.assertions(4);
      for (const direction of ALL_DIRECTIONS) {
        expect(opposite(opposite(direction))).toBe(direction);
      }
    });

    it('never returns the direction it was given', () => {
      expect.assertions(4);
      for (const direction of ALL_DIRECTIONS) {
        expect(opposite(direction)).not.toBe(direction);
      }
    });
  });

  describe('isOpposite', () => {
    /**
     * This rule exists because ghosts may not reverse direction mid-corridor
     * in the original game — reversal happens only on a scatter/chase mode
     * change. The predicate is what enforces it.
     */
    it('is true for a direction and its reverse', () => {
      expect(isOpposite(Direction.Up, Direction.Down)).toBe(true);
    });

    it('is false for perpendicular directions', () => {
      expect(isOpposite(Direction.Up, Direction.Left)).toBe(false);
    });

    it('is false for the same direction', () => {
      expect(isOpposite(Direction.Up, Direction.Up)).toBe(false);
    });
  });

  describe('ALL_DIRECTIONS', () => {
    it('contains exactly the four cardinal directions', () => {
      expect(ALL_DIRECTIONS).toEqual([
        Direction.Up,
        Direction.Left,
        Direction.Down,
        Direction.Right,
      ]);
    });

    /**
     * The order is not cosmetic. When several ghost targets tie in distance,
     * the arcade resolves the tie by preferring up, then left, then down.
     * Right is never preferred. Later AI code depends on this ordering.
     */
    it('is ordered up, left, down, right to match arcade tie-breaking', () => {
      expect(ALL_DIRECTIONS[0]).toBe(Direction.Up);
      expect(ALL_DIRECTIONS[1]).toBe(Direction.Left);
      expect(ALL_DIRECTIONS[2]).toBe(Direction.Down);
    });
  });
});
