import { type Rng } from '../rng/rng.ts';

/**
 * SIGNATURE-ONLY STUB — RED phase. No behaviour: see geometry/tile.ts for why.
 */

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
 */
export function createScriptedRng(_values: readonly number[]): Rng {
  return {
    next: (): number => 0,
    nextInt: (_maxExclusive: number): number => 0,
  };
}
