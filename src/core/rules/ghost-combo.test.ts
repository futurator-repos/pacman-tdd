import { describe, expect, it } from 'vitest';

import { chainAfterGhostEaten, chainAfterPowerPellet, ghostPoints } from './ghost-combo.ts';

/**
 * The ghost-scoring ladder.
 *
 * Every number in this file comes from docs/ARCADE-REFERENCE.md section 13.2,
 * which quotes the Dossier verbatim:
 *
 *   "The first ghost captured after an energizer has been eaten is always worth
 *    200 points. Each additional ghost captured from the same energizer will
 *    then be worth twice as many points as the one before it—400, 800, and
 *    1,600 points, respectively."
 *
 * The ladder is indexed by how many ghosts have already been eaten during the
 * CURRENT fright, so `ghostPoints(0)` is the value of the first one. That is
 * "how many have happened", not "which one is this" — an index, not an ordinal —
 * and it is worth being clear about, because the off-by-one between the two
 * readings turns a 3000-point chain into a 3800-point one.
 *
 * Nothing here stores the count. Where it lives is slice s09's problem and how
 * it is updated is slice s11's; these are pure functions over an integer, which
 * is what lets the whole ladder be specified in a handful of calls instead of by
 * playing a level with four ghosts in a corner.
 */
describe('ghostPoints', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: A pure lookup over one integer. Four calls state the whole
   *   ladder; producing four ghost-eats inside a running game to assert the same
   *   thing would need a maze, a fright timer, four ghosts and a collision
   *   system, and would then be testing those instead of this.
   * MEASURES: ghostPoints(0), (1), (2) and (3) — the first through fourth ghost
   *   eaten during one fright.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.2 (Dossier, "Scoring"): 200, then
   *   double each time — 400, 800, 1600.
   * CATCHES: A linear ladder (200/400/600/800), which reads perfectly plausibly
   *   in a diff and on screen. The 3000-point four-ghost chain — the single
   *   biggest scoring opportunity in the game, and the thing skilled play is
   *   organised around — quietly stops existing.
   * LOAD-BEARING: yes (the stub returns 0 for every rung).
   */
  it('awards 200, 400, 800 then 1600 for the first through fourth ghost of one fright', () => {
    expect.assertions(4);

    expect(ghostPoints(0)).toBe(200);
    expect(ghostPoints(1)).toBe(400);
    expect(ghostPoints(2)).toBe(800);
    expect(ghostPoints(3)).toBe(1600);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A totality question about a pure function, and unanswerable
   *   anywhere else: there are only four ghosts, so a fifth capture in one fright
   *   cannot be produced through the game. Only a direct call can define what the
   *   contract is.
   * MEASURES: ghostPoints(4) — an input the type system permits and the game
   *   cannot reach.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.2, "the cap": the function returns
   *   1600 rather than reading off the end of the ladder.
   * CATCHES: An array index off the end. Under noUncheckedIndexedAccess that is
   *   `undefined`, which reaches addScore, makes the score NaN, and stays NaN for
   *   the rest of the game because NaN plus anything is NaN. The HUD then shows
   *   "NaN" and no further scoring is possible.
   * LOAD-BEARING: yes (the stub returns 0, not 1600). The test plan expected this
   *   one to be a guard satisfied by any defined value; asserting the documented
   *   1600 exactly, as the house rules require, makes it pin real behaviour.
   */
  it('caps an impossible fifth ghost at 1600 rather than reading off the end of the ladder', () => {
    expect(ghostPoints(4)).toBe(1600);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The ladder and the counter are two functions, and the number
   *   players actually care about — 3000 for a full chain — is a property of the
   *   two of them TOGETHER. Neither test above would notice a counter that failed
   *   to advance. Still a unit: it is four calls of arithmetic, with no state and
   *   no game.
   * MEASURES: The total scored by eating all four ghosts of one fright, and the
   *   chain the fourth capture leaves behind.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.2: 200 + 400 + 800 + 1600 = 3000
   *   for a complete chain of four.
   * CATCHES: A counter that does not advance — every ghost worth 200, a chain
   *   worth 800 instead of 3000 — which the four-rung test above cannot see
   *   because it indexes the ladder by hand.
   * LOAD-BEARING: yes (against the stub the fold totals 0).
   *
   * The loop below contains NO assertion, which is deliberate: an assertion
   * inside a loop passes vacuously when the loop body never runs. Folding first
   * and asserting afterwards removes that hazard rather than guarding against it.
   */
  it('pays 3000 for a complete chain of four ghosts in one fright', () => {
    let chain = 0;
    let total = 0;

    for (let ghost = 0; ghost < 4; ghost += 1) {
      total += ghostPoints(chain);
      chain = chainAfterGhostEaten(chain);
    }

    expect(total).toBe(3000);
    expect(chain).toBe(4);
  });
});

describe('chainAfterGhostEaten', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One step of a counter. There is nothing to integrate, and a
   *   property test would only restate `n + 1`.
   * MEASURES: That eating a ghost ADVANCES the chain rather than resetting it,
   *   from the first capture and from mid-chain.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.2: "each additional ghost captured
   *   from the same energizer will then be worth twice as many points as the one
   *   before it" — so a capture moves the ladder up, and the section states
   *   explicitly that eating a ghost is not what resets it.
   * CATCHES: The reset put on the wrong event. Every ghost is then worth 200,
   *   which looks like a working feature and costs a good player thousands of
   *   points a level.
   * LOAD-BEARING: yes (the stub returns 0, so the chain never advances).
   */
  it('climbs the ladder when a ghost is eaten, because a capture is what advances it', () => {
    expect.assertions(3);

    expect(chainAfterGhostEaten(0)).toBe(1);
    expect(chainAfterGhostEaten(1)).toBe(2);
    expect(chainAfterGhostEaten(3)).toBe(4);
  });
});

describe('chainAfterPowerPellet', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: The rule is a decision about two numbers taken at one moment,
   *   and this is the cheapest place it can be stated exactly once. Reaching the
   *   same situation through the pipeline needs a fright already running, two
   *   ghosts already eaten and a second energizer under Pac-Man — an expensive
   *   setup for a rule that is a single comparison. The wiring of that setup is
   *   slice s11's integration test; the RULE is here.
   * MEASURES: That a power pellet taken while the fright timer is still running
   *   leaves the chain untouched, so the next ghost is still worth 800.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.2, "when the ladder resets": the
   *   ladder resets when the fright PERIOD ENDS, so an energizer taken while the
   *   ghosts are already blue extends that period and the ladder keeps climbing.
   *   The section records this as a [repo convention] and states openly that the
   *   Dossier sentence quoted above reads like the other answer — it describes
   *   the ordinary case, where no fright is running and both rules agree.
   * CATCHES: The ladder reset on every power pellet. A player who chains a second
   *   energizer mid-fright silently loses several thousand points, and the
   *   scoring stays "nearly right" — the kind of discrepancy that only a replay
   *   fixture asserting an exact final score would otherwise expose.
   * LOAD-BEARING: yes (the stub returns 0, i.e. the reset this test forbids).
   */
  it('keeps the ladder where it is when a power pellet is taken while the ghosts are still blue', () => {
    expect.assertions(2);

    /* Two ghosts already eaten, 45 frames of fright still to run. */
    expect(chainAfterPowerPellet(2, 45)).toBe(2);
    /* And the very last frame of fright is still fright. */
    expect(chainAfterPowerPellet(2, 1)).toBe(2);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The other side of the same comparison, given its own name so
   *   that the pair reads as one rule with two cases rather than as a condition
   *   somebody can flip without noticing.
   * MEASURES: That a power pellet taken with no fright running starts the ladder
   *   again at the first rung, whatever the previous fright reached.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.2: the first ghost captured after
   *   an energizer is worth 200 whenever no fright was already running — the
   *   ordinary case, where the Dossier and this codebase agree exactly.
   * CATCHES: A ladder that is never reset at all. The second energizer of a level
   *   would open at 1600 and every later one would pay 1600 a ghost, which
   *   roughly doubles a competent player's score.
   * LOAD-BEARING: no — the stub returns 0 and this test expects 0, so it passes
   *   against a do-nothing implementation. It is a GUARD, kept because it is half
   *   of a rule whose other half (above) is load-bearing: on its own it proves
   *   nothing, and beside its partner it is what stops the comparison being
   *   written the wrong way round.
   */
  it('starts the ladder again at the first rung when a power pellet is taken with no fright running', () => {
    expect.assertions(2);

    expect(chainAfterPowerPellet(3, 0)).toBe(0);
    expect(chainAfterPowerPellet(0, 0)).toBe(0);
  });
});
