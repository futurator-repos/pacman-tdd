/**
 * STUB - signatures only, no behaviour. Present so the tests execute and fail
 * on their assertions. See docs/TDD-CHARTER.md, Challenge 1.
 */

export interface Rng {
  /** A value in [0, 1). */
  next(): number;
  /** An integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

export function createRng(_seed: number): Rng {
  return {
    next(): number {
      return 0;
    },
    nextInt(_maxExclusive: number): number {
      return 0;
    },
  };
}
