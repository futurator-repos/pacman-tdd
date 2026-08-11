import { type Rng } from '../rng/rng.ts';

/**
 * An `Rng` that hands back a script of values, in order.
 *
 * This is a test double, and it lives in `src/core/testing/` as production
 * code held to the same 100% coverage bar as the rest of core — because a
 * helper that shapes every other test deserves to be correct.
 *
 * Its whole reason to exist: "a frightened ghost turns randomly" is not
 * something a test can assert. "A frightened ghost given this draw turns left"
 * is. Scripting the stream turns a probabilistic rule into an equality
 * assertion, and — because it throws when the script runs out — it also turns
 * "consumes exactly one draw per decision" into an assertion rather than a
 * hope.
 *
 * Every rule below exists to keep the double SUBSTITUTABLE for `createRng`. A
 * double that is more permissive than the real thing lets code pass tests the
 * real generator would have rejected, which is the one failure mode that makes
 * a test suite actively misleading:
 *
 *   - the script is validated at CREATION, so a script of indices rather than
 *     [0, 1) fractions blames the test that wrote it, not the code under test;
 *   - `nextInt` refuses a non-positive range exactly as `createRng` does, and
 *     refuses it before drawing, so an error path costs no draw;
 *   - `next` and `nextInt` share ONE cursor, because `createRng` derives
 *     `nextInt` from a single call to `next`;
 *   - the caller's array is never mutated, so one script may be built once and
 *     read by two actors without the second silently starting mid-stream.
 */
export function createScriptedRng(values: readonly number[]): Rng {
  for (const value of values) {
    if (value < 0 || value >= 1) {
      throw new RangeError(`a scripted Rng value must be in [0, 1), received ${String(value)}`);
    }
  }

  /* A cursor rather than `shift()`: see the aliasing note above. */
  let cursor = 0;

  const next = (): number => {
    const value = values[cursor];
    if (value === undefined) {
      throw new RangeError(
        `scripted Rng script exhausted after ${String(values.length)} draw(s): the code under test took one more than the script provides`,
      );
    }
    cursor += 1;
    return value;
  };

  return {
    next,
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) {
        throw new RangeError(`nextInt requires a positive range, received ${String(maxExclusive)}`);
      }
      return Math.floor(next() * maxExclusive);
    },
  };
}
