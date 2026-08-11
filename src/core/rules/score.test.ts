import { describe, expect, it } from 'vitest';

import { FruitKind } from './level-spec.ts';
import { levelSpec } from './level-table.ts';
import { EXTRA_LIFE_AT, POINTS } from './points.ts';
import { addScore } from './score.ts';

/**
 * The score, and the one event that comes with it.
 *
 * Two separate things are pinned here, and they are in the same file because
 * they are the same sentence: adding points is how the extra life is earned.
 *
 * The point values come from docs/ARCADE-REFERENCE.md section 13.1 (the Dossier,
 * verbatim: ten points a dot, fifty an energizer) and the extra life from
 * section 13.3 (a [repo convention] fixing the cabinet's factory DIP setting at
 * 10000). A reader can check every literal below against those two sections
 * without opening a single source file, which is the whole contract.
 */
describe('the point values', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Constants. A unit is the only sensible home — asserting them
   *   through gameplay would make the arithmetic of scoring hostage to movement
   *   and collision both working first, and a failure would say "the game scored
   *   wrongly" rather than "the dot is worth the wrong number".
   * MEASURES: POINTS.pellet, POINTS.powerPellet, EXTRA_LIFE_AT, and that the
   *   bonus item's value is read from the level's own row rather than from a
   *   second table.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.1 — "The 240 small dots are worth
   *   ten points each, and the four large, flashing dots—best known as
   *   energizers—are worth 50 points each"; section 13.3 — one extra life at
   *   10000; section 3 row 1 — a level-1 cherry is worth 100.
   * CATCHES: A power pellet worth 40 — the charter's own worked example of a
   *   legitimate test change. Every score in the game would then be wrong by a
   *   slowly growing amount, the extra life would arrive at the wrong moment, and
   *   the committed replay fixtures, which assert exact final scores, would start
   *   failing with no clue as to why.
   * LOAD-BEARING: yes, in part. The three constants fail against the stub, which
   *   holds zeros. The two levelSpec assertions PASS at RED: levelSpec is real
   *   code from slice s04. They are here anyway, because the claim being made is
   *   "there is one fruit table and it is the level table" — a claim about where
   *   a number lives, which is only visible when both readings sit side by side.
   */
  it('scores a plain pellet at 10, a power pellet at 50, a level 1 cherry at 100 and the extra life at 10000', () => {
    expect(POINTS.pellet).toBe(10);
    expect(POINTS.powerPellet).toBe(50);
    expect(EXTRA_LIFE_AT).toBe(10000);

    /* The bonus item's value is per level, and section 3 already tabulates it.
       points.ts deliberately holds no fruit table of its own: two copies of one
       fact are two things to keep in step. */
    expect(levelSpec(1).fruit).toBe(FruitKind.Cherry);
    expect(levelSpec(1).fruitPoints).toBe(100);
  });
});

describe('addScore', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One addition. It is here rather than assumed because the
   *   extra-life tests below would all still pass if addScore returned the wrong
   *   score alongside the right flag — "did it award the life" and "is the total
   *   right" are two claims, and each needs its own assertion.
   * MEASURES: That points are added to the running score, well away from any
   *   threshold.
   * ORACLE: Arithmetic over the values in docs/ARCADE-REFERENCE.md sections 13.1
   *   and 13.2: a dot on an empty score is 10, and a third ghost taken at 1230 is
   *   1230 + 800 = 2030.
   * CATCHES: A function that returns the points instead of the total, or that
   *   drops the addition entirely. Either freezes the HUD at a number that never
   *   grows, which is not subtle — but nothing else in this file would fail, and
   *   an unasserted claim is an unprotected one.
   * LOAD-BEARING: yes (the stub returns a score of 0).
   */
  it('adds points to the running score', () => {
    expect.assertions(2);

    expect(addScore(0, 10).score).toBe(10);
    expect(addScore(1230, 800).score).toBe(2030);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A crossing detector, which is only meaningfully testable by
   *   stepping ACROSS the threshold and then continuing past it. A unit does that
   *   in three calls with no game state at all; through the pipeline it would take
   *   a thousand dots of setup to reach 10000.
   * MEASURES: extraLifeAwarded on two additions that finish BELOW the line, on
   *   the addition that takes the score from 9990 to exactly 10000, and on two
   *   later additions that leave it far above.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.3: one bonus life, at 10000
   *   points, awarded once per game — and awarded on the crossing, not while the
   *   score is above the line and not while it is below.
   * CATCHES: A predicate written `after >= EXTRA_LIFE_AT`. The player is then
   *   given a life on every scoring event for the rest of the game and finishes
   *   with ninety of them, which makes the game unloseable and the lives row
   *   nonsense.
   *
   *   And its mirror image, `before < EXTRA_LIFE_AT`, which is the same bug
   *   pointing the other way: a life for every dot from the first to the ten
   *   thousandth. It reads correctly, and without the two below-the-line
   *   assertions it passes every other test in this file — it was written and it
   *   did. A crossing is a claim about BOTH ends, so both are asserted.
   * LOAD-BEARING: yes — the 9990 assertion expects true and the stub reports
   *   false. The four other assertions pass against the stub; they are the halves
   *   of the sentence that catch the two one-ended readings.
   */
  it('awards the extra life on the addition that crosses 10000, and never below or again above', () => {
    expect.assertions(5);

    /* Wholly below the line: nothing is earned. */
    expect(addScore(0, 10).extraLifeAwarded).toBe(false);
    expect(addScore(9000, 500).extraLifeAwarded).toBe(false);

    /* The crossing itself. */
    expect(addScore(9990, 10).extraLifeAwarded).toBe(true);

    /* And never again, however far the score climbs. */
    expect(addScore(10000, 50).extraLifeAwarded).toBe(false);
    expect(addScore(23450, 1600).extraLifeAwarded).toBe(false);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The same rule at the input that distinguishes a crossing from
   *   an equality, which no amount of play would reliably reproduce: it needs a
   *   single scoring event large enough to jump the threshold outright.
   * MEASURES: A 3000-point full ghost chain taken at 9000 — the score passes
   *   10000 without ever equalling it.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.3, which names this exact wrong
   *   reading: `after === 10000` awards nothing when a big chain leaps the line.
   *   The 3000 is the complete four-ghost chain of section 13.2.
   * CATCHES: An equality check. The extra life is then unreachable for exactly
   *   the players good enough to score in large jumps — the bug looks like "it
   *   works for me" to anyone testing by eating dots.
   * LOAD-BEARING: yes (the stub reports false).
   */
  it('awards the extra life when a 3000-point ghost chain leaps clean over 10000', () => {
    expect.assertions(2);

    const result = addScore(9000, 3000);

    expect(result.score).toBe(12000);
    expect(result.extraLifeAwarded).toBe(true);
  });
});
