import { describe, expect, it } from 'vitest';

import { createScriptedRng } from './scripted-rng.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * There is exactly one random decision in Pac-Man: a frightened ghost picks
 * its turn pseudo-randomly. That single draw is enough to make a whole test
 * suite non-deterministic if it is left to chance, so the rules take an `Rng`
 * as an injected dependency (see src/core/rng/rng.ts) and a lint rule forbids
 * `Math.random` anywhere in core.
 *
 * Injection alone still leaves a test saying "the ghost turned SOMEWHERE
 * legal", which is a weak claim. `createScriptedRng` closes the gap: hand the
 * ghost the draws, and "a frightened ghost turns randomly" becomes an equality
 * assertion — this script, that turn.
 *
 * Two properties make it a test double rather than a toy, and both are pinned
 * below:
 *
 *   1. It THROWS when the script runs out. Consuming one extra draw is the
 *      classic silent bug — it does not fail here, it shifts every subsequent
 *      draw and breaks a test five files away. A loud failure at the point of
 *      the extra draw turns "consumes exactly one draw per decision" into
 *      something a test can assert.
 *   2. It is SUBSTITUTABLE for the real `createRng`: same interface, same
 *      contracts, same errors. A double that is more permissive than the thing
 *      it stands in for lets code pass tests that the real implementation
 *      would reject.
 *
 * This file is why `src/core/testing/` is treated as production code, held to
 * the same 100% coverage bar: a helper that shapes every other test deserves
 * to be correct.
 */

describe('createScriptedRng', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: a pure function over an array; three calls state the whole
   *   behaviour. Nothing to integrate.
   * MEASURES: that `next` returns the scripted values in the order given, one
   *   per call.
   * ORACLE: docs/ARCHITECTURE.md s01 — "createScriptedRng returns its values
   *   in order". The values are deliberately not sorted and not evenly spaced,
   *   so a generator that returned them shuffled, reversed or interpolated
   *   would not match.
   * CATCHES: an implementation that returns the same value every time, or
   *   reads the script backwards. Every test built on top of it would then
   *   assert a ghost turn that the real Rng would never produce, and the whole
   *   frightened-movement suite would be quietly meaningless.
   * LOAD-BEARING: yes — the stub returns 0 forever.
   */
  it('returns its scripted values in order, one per draw', () => {
    const rng = createScriptedRng([0.5, 0.25, 0.75]);

    expect([rng.next(), rng.next(), rng.next()]).toEqual([0.5, 0.25, 0.75]);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: two examples of one rule — a script that runs out, and a
   *   script that was empty to begin with. Both are single calls; there is
   *   nothing cheaper than a thrown error to observe.
   * MEASURES: that drawing past the end of the script throws, and that the
   *   draws BEFORE the end still work.
   * ORACLE: docs/ARCHITECTURE.md s01 — "throws when the script is exhausted so
   *   a silent extra draw fails loudly rather than surprising a later test".
   *   The message must contain the words "script exhausted": docs/TEST-PLAN.md
   *   has a later test (frightened turns, slice s06) asserting on exactly that
   *   phrase, so it is part of this double's contract rather than a detail of
   *   its wording.
   * CATCHES: returning `undefined` — which is what indexing past the end of an
   *   array does — and letting it flow into ghost code as NaN. The ghost picks
   *   direction index NaN, gets `undefined`, and the failure surfaces as a
   *   crash in the renderer with no hint that the Rng was over-drawn.
   * LOAD-BEARING: yes — the stub returns 0 for every draw and never throws.
   */
  it('throws when the script is exhausted, so a silent extra draw fails loudly', () => {
    const rng = createScriptedRng([0.5]);

    expect(rng.next()).toBe(0.5);
    expect(() => rng.next()).toThrow(/script exhausted/i);

    expect(() => createScriptedRng([]).next()).toThrow(/script exhausted/i);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: a table of five scripted values covering both ends of the
   *   range in one call each. The mapping is a total function of one number,
   *   so five well-chosen points state it completely.
   * MEASURES: that `nextInt(4)` turns a scripted [0,1) value into an integer
   *   in [0,4) by the same rule the real generator uses — floor(value * max) —
   *   including that 0.999 maps to 3 and never to 4.
   * ORACLE: the `Rng` interface contract as documented in src/core/rng/rng.ts
   *   ("an integer in [0, maxExclusive)") plus substitutability with
   *   `createRng`, whose conversion is `Math.floor(next() * maxExclusive)`. So
   *   0 -> 0, 0.25 -> 1, 0.5 -> 2, 0.75 -> 3, 0.999 -> 3.
   * CATCHES: a double that treats the script as raw indices instead of [0,1)
   *   values. A test author writes [0, 1, 2, 3] meaning "up, left, down,
   *   right", the double returns them unchanged, the test passes — and the
   *   real Rng, given the same situation, would have produced something else
   *   entirely. The test would be pinning the double, not the game.
   * LOAD-BEARING: yes — the stub returns 0 for every call.
   */
  it('maps a scripted value into [0, maxExclusive) exactly as the real Rng does', () => {
    const rng = createScriptedRng([0, 0.25, 0.5, 0.75, 0.999]);

    expect([
      rng.nextInt(4),
      rng.nextInt(4),
      rng.nextInt(4),
      rng.nextInt(4),
      rng.nextInt(4),
    ]).toEqual([0, 1, 2, 3, 3]);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: three interleaved calls. The claim is about ONE shared
   *   cursor, which only a sequence of mixed calls can observe.
   * MEASURES: that `next` and `nextInt` draw from the same stream in call
   *   order, rather than each keeping its own position in the script.
   * ORACLE: the `Rng` contract in src/core/rng/rng.ts — `createRng` derives
   *   `nextInt` from a single call to `next`, so one draw is one advance of
   *   one stream whichever method makes it. Script [0.5, 0.75, 0.25] therefore
   *   gives 0.5, then floor(0.75*4)=3, then 0.25.
   * CATCHES: two independent cursors. Ghost code that mixes the two methods
   *   would consume the script twice over, so a replay driven by the real Rng
   *   and a test driven by this double would diverge — and the double would be
   *   the one lying.
   * LOAD-BEARING: yes — the stub returns 0 from both methods.
   */
  it('draws next and nextInt from one shared stream, in call order', () => {
    const rng = createScriptedRng([0.5, 0.75, 0.25]);

    expect(rng.next()).toBe(0.5);
    expect(rng.nextInt(4)).toBe(3);
    expect(rng.next()).toBe(0.25);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: two invalid constructions, each a single call. Validating
   *   at construction rather than at draw time is the behaviour being pinned,
   *   and construction is where it is observable.
   * MEASURES: that a script value outside [0, 1) is rejected when the double
   *   is CREATED — not silently accepted and not deferred to the draw.
   * ORACLE: the `Rng` contract in src/core/rng/rng.ts — "a value in [0, 1)".
   *   A double that emits values the real generator cannot emit is not a
   *   double. 1 is outside because the interval is half-open; -0.5 is outside
   *   below.
   * CATCHES: the "indices, not fractions" mistake again, in the form that the
   *   nextInt test above cannot see: a script of [0, 1, 2, 3] would make
   *   `nextInt(4)` return 4, 8, 12 — indices past the end of the direction
   *   list, producing `undefined` under noUncheckedIndexedAccess. Rejecting it
   *   at creation puts the error message in the test that made the mistake,
   *   with the offending value in it, instead of in the code under test.
   * LOAD-BEARING: yes — the stub validates nothing and throws nothing.
   */
  it('rejects a script value outside [0, 1) when it is created, not when it is drawn', () => {
    /* The message must name the interval, so the author of a bad script can
       see immediately what shape of number was expected. */
    expect(() => createScriptedRng([0.5, 1])).toThrow(/0, 1/);
    expect(() => createScriptedRng([-0.5])).toThrow(/0, 1/);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: two invalid ranges plus one follow-up draw, in one call
   *   sequence. The follow-up is what shows the rejection was free of side
   *   effects.
   * MEASURES: that `nextInt` rejects a non-positive range with the same error
   *   the real generator gives, and that the rejected call consumed nothing
   *   from the script.
   * ORACLE: src/core/rng/rng.ts — "an integer in [0, maxExclusive). Throws if
   *   the range is not positive", asserted there as `toThrow(/positive/i)`.
   *   Substitutability means the double must refuse exactly what the real one
   *   refuses.
   * CATCHES: a permissive double. Code that calls `nextInt(0)` — a ghost at a
   *   junction with an empty list of legal directions, which is a real bug
   *   worth surfacing — would pass every test against this double and throw
   *   only in the browser. The "still returns 0.5" assertion additionally
   *   catches a double that burns a draw before validating, which would shift
   *   every later expectation in a test that exercises an error path.
   * LOAD-BEARING: yes — the stub returns 0 rather than throwing.
   */
  it('rejects a non-positive range exactly as the real Rng does, without consuming a draw', () => {
    const rng = createScriptedRng([0.5]);

    expect(() => rng.nextInt(0)).toThrow(/positive/i);
    expect(() => rng.nextInt(-5)).toThrow(/positive/i);
    expect(rng.next()).toBe(0.5);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: one construction, two draws, one assertion on the caller's
   *   array. Nothing else can observe aliasing.
   * MEASURES: that drawing does not consume the array the caller passed in —
   *   the double must keep its own cursor rather than shifting values off the
   *   script.
   * ORACLE: stated design invariant (docs/ARCHITECTURE.md) — core deals in
   *   immutable values and never mutates its arguments. The `readonly
   *   number[]` parameter type states the intent; this states the behaviour,
   *   which the type alone cannot enforce at runtime.
   * CATCHES: an implementation using `values.shift()`. A test that builds one
   *   script and hands it to two ghosts would see the second ghost start
   *   mid-script, and the failure would look like a bug in ghost ordering.
   * LOAD-BEARING: NO — predicted to PASS against the do-nothing stub, which
   *   holds no state and therefore cannot mutate anything. It is kept
   *   deliberately as a GUARD: it pins nothing today and constrains every
   *   implementation from tomorrow. docs/TDD-FINDINGS.md is explicit that not
   *   every test should fail in the red phase — what matters is predicting
   *   which, and being able to name the load-bearing test for each behaviour.
   */
  it('does not consume or otherwise mutate the array it was given', () => {
    const script = [0.1, 0.2];
    const rng = createScriptedRng(script);

    rng.next();
    rng.next();

    expect(script).toEqual([0.1, 0.2]);
  });
});
