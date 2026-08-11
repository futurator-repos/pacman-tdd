/**
 * SIGNATURE-ONLY STUB — RED phase of slice s03.
 *
 * No behaviour: `FULL_SPEED` is deliberately 0 rather than 320, and
 * `speedSubPixels` ignores its argument. A stub that returned the real
 * constant would make an assertion pass that ought to be failing, which is the
 * one thing a stub must never do (docs/TDD-FINDINGS.md, "the stub is a
 * measuring instrument").
 */

/**
 * The arcade's 100% speed, in sub-pixels per frame.
 *
 * Every speed in the level table is stated as a fraction of this one number,
 * and this module is the only place such a fraction becomes an integer.
 */
export const FULL_SPEED = 0;

/**
 * An arcade speed percentage as a whole number of sub-pixels per frame.
 *
 * Whole, because the sub-pixel carry is integer arithmetic: a float here would
 * accumulate error and a long replay would drift away from the run it claims
 * to reproduce.
 */
export function speedSubPixels(_fraction: number): number {
  return 0;
}
