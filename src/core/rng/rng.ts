/**
 * A seeded pseudo-random number generator.
 *
 * The game rules take this as an injected dependency and never reach for
 * `Math.random()` — a lint rule in eslint.config.ts enforces that. The payoff
 * is replayability: a game that went wrong can be reproduced exactly from its
 * seed and its input log, instead of from a description of what someone saw.
 */
export interface Rng {
  /** A value in [0, 1). */
  next(): number;
  /** An integer in [0, maxExclusive). Throws if the range is not positive. */
  nextInt(maxExclusive: number): number;
}

const UINT32_RANGE = 0x1_0000_0000;
const MULBERRY_INCREMENT = 0x6d_2b_79_f5;

/**
 * mulberry32: a small, fast, well-distributed 32-bit generator.
 *
 * Chosen over a naive LCG because the low bits of an LCG are notoriously
 * non-random, and `nextInt` on a four-element range reads exactly those bits —
 * which would quietly bias ghost turns. The "reaches every value in a small
 * range" test is what would catch that.
 */
export function createRng(seed: number): Rng {
  let state = seed | 0;

  const next = (): number => {
    state = (state + MULBERRY_INCREMENT) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };

  return {
    next,
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(
          `nextInt requires a positive integer range, received ${String(maxExclusive)}`,
        );
      }
      return Math.floor(next() * maxExclusive);
    },
  };
}
