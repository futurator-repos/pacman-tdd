import { describe, expect, it } from 'vitest';

import { FULL_SPEED, speedSubPixels } from './speed.ts';

/**
 * Speed: the one place an arcade percentage becomes an integer.
 *
 * The arcade states every actor's speed as a percentage of "full speed" — 80%
 * for Pac-Man on level 1, 75% for the ghosts, 40% for a ghost in the tunnel.
 * Nothing else in the game may multiply by a percentage; everything downstream
 * receives whole sub-pixels per frame, because whole numbers are what make a
 * ten-thousand-frame replay reproduce exactly.
 *
 * ORACLE FOR THE WHOLE FILE. Two independent sources, and it is worth being
 * precise about which is which:
 *   1. The speed PERCENTAGES are arcade facts, from the per-level speed table
 *      in docs/ARCADE-REFERENCE.md section 3 (transcribed from the Pac-Man
 *      Dossier's level table). Level 1: Pac-Man 80%, Pac-Man eating dots ~71%,
 *      ghosts 75%, ghost in tunnel 40%.
 *   2. The CONVERSION is docs/ARCADE-REFERENCE.md section 2, "Speed: what 80%
 *      means", which derives it from the Dossier's "100% speed = 75.75757625
 *      pixels/sec": divided by the board's 60.606061 frames/sec that is 1.25
 *      pixels per frame at 100%, and a pixel is SUBPIXELS_PER_PIXEL = 256
 *      sub-pixels, so
 *
 *          FULL_SPEED = 1.25 * 256 = 320 sub-pixels per frame at 100%
 *
 *      and `speedSubPixels(fraction) = Math.round(fraction * FULL_SPEED)`.
 *      That document also records the cost of the carry model honestly: it
 *      reproduces the arcade's AVERAGE speed exactly, while the original
 *      hardware's per-frame move/skip pattern can differ by a pixel on an
 *      individual frame.
 *
 * FULL_SPEED is NOT SUBPIXELS_PER_PIXEL. Conflating them is the easy mistake
 * here and it is worth naming: 256 sub-pixels is how finely a PIXEL is divided,
 * 320 sub-pixels is how far a 100% actor travels in a FRAME. The independent
 * check that the 320 is right is a fact anybody can see in the original game —
 * level-1 Pac-Man, at 80%, advances exactly one pixel per frame, and
 * 0.8 * 320 = 256 sub-pixels is exactly one pixel. A FULL_SPEED of 256 would
 * make him 0.8 px/frame and run the whole game 20% slow.
 *
 * Every expected value below is that arithmetic done by hand — 0.71 * 320 =
 * 227.2, which rounds to 227 — never a number read back out of the
 * implementation.
 */
describe('speed', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: A single named constant. There is nothing cheaper, and
   *   nothing to integrate: no other module may define its own idea of "full
   *   speed", which is precisely why it is asserted on its own.
   * MEASURES: That full speed is 320 sub-pixels per frame — one and a quarter
   *   pixels per frame at the arcade's 60.606061Hz frame rate.
   * ORACLE: docs/ARCADE-REFERENCE.md section 2: the Dossier's "100% speed =
   *   75.75757625 pixels/sec" over 60.606061 frames/sec is 1.25 pixels per
   *   frame, and 1.25 * 256 sub-pixels per pixel = 320. The percentages in
   *   that document's level table are fractions OF this number.
   * CATCHES: Two mistakes at once. FULL_SPEED set to 1 (whole pixels), which
   *   collapses every speed in the table to the same integer after rounding —
   *   Pac-Man, the ghosts, Cruise Elroy and a ghost crawling through the
   *   tunnel all move at identical speed and the entire difficulty curve
   *   silently disappears. And FULL_SPEED set to SUBPIXELS_PER_PIXEL (256),
   *   the plausible-looking conflation of "how finely a pixel is divided" with
   *   "how far a 100% actor travels in a frame", which runs every actor in the
   *   game 20% slow: nothing looks broken, and no other test in the suite
   *   would notice, but level-1 Pac-Man moves 0.8 px/frame where the original
   *   moves exactly 1.
   * LOAD-BEARING: yes
   */
  it('full speed is 320 sub-pixels per frame, which is one and a quarter pixels per frame', () => {
    expect(FULL_SPEED).toBe(320);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The interesting domain is the finite set of fractions the
   *   arcade level table actually contains, so enumerating four of them by
   *   hand is both cheaper and more precise than generating inputs. Each
   *   expected value is one multiplication anybody can check while reading.
   * MEASURES: The conversion at the documented level-1 speeds; the two
   *   level-1 fractions that do NOT divide exactly, which is what pins the
   *   rounding MODE; and a speed above 100% (a ghost's eyes travel home faster
   *   than anything alive), so nobody "helpfully" clamps the function at full
   *   speed.
   * ORACLE: docs/ARCADE-REFERENCE.md level-1 row — Pac-Man 80%, Pac-Man eating
   *   dots ~71%, ghosts 75%, ghost in tunnel 40% — applied to FULL_SPEED = 320
   *   and rounded to the nearest whole sub-pixel:
   *     0.80*320 = 256 exactly   (one whole pixel per frame, as in the arcade)
   *     0.75*320 = 240 exactly
   *     0.40*320 = 128 exactly
   *     0.71*320 = 227.2  -> 227
   *     0.79*320 = 252.8  -> 253
   *     1.00*320 = 320 exactly
   *     1.50*320 = 480 exactly
   * CATCHES: A conversion that returns a float (0.71 * 320 = 227.2 stored as
   *   is). The carry then accumulates float error, and a replay that ran
   *   perfectly at commit time desynchronises minutes in — the bug report
   *   reads "the ghost caught me in the replay but not in the game". The two
   *   inexact fractions additionally pin the rounding MODE that
   *   docs/ARCADE-REFERENCE.md states: 227.2 rules out ceil, 252.8 rules out
   *   floor and truncation, so only round-to-nearest survives. Without them
   *   every expectation here is an exact multiple and the rounding rule is
   *   unpinned.
   * LOAD-BEARING: yes
   */
  it('converts the documented level-1 percentages into whole sub-pixels per frame', () => {
    expect(speedSubPixels(0.8)).toBe(256);
    expect(speedSubPixels(0.75)).toBe(240);
    expect(speedSubPixels(0.4)).toBe(128);
    expect(speedSubPixels(0.71)).toBe(227);
    expect(speedSubPixels(0.79)).toBe(253);
    expect(speedSubPixels(1)).toBe(320);
    expect(speedSubPixels(1.5)).toBe(480);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A table walk over every distinct fraction the level table
   *   uses. Two facts are asserted together because they are two halves of the
   *   same guarantee — a conversion is only useful to the carry if it is a
   *   whole number AND if it is the same whole number every time it is asked.
   * MEASURES: Integrality across the whole table, and that repeating a call
   *   returns an identical value.
   * ORACLE: Stated invariant of the sub-pixel design in docs/ARCHITECTURE.md:
   *   positions are integers, so a per-frame step must be an integer too, and
   *   a pure function of one number must be stable.
   * CATCHES: A conversion that rounds one particular fraction differently on a
   *   second call (a memoised cache keyed wrongly), or that returns 227.2 for
   *   a fraction nobody wrote an exact expectation for.
   * LOAD-BEARING: no — a stub returning 0 gives an integer, and gives the same
   *   integer twice. It is a guard, kept because it states the precondition
   *   every movement test in move-actor.test.ts silently assumes, and it
   *   covers the fractions that no hand-written expectation above pins.
   */
  it('returns a stable integer for every fraction in the arcade level table', () => {
    /**
     * Every distinct speed fraction in docs/ARCADE-REFERENCE.md's section-3
     * table, read across all nine speed columns and all 21 rows: Pac-Man
     * (0.8/0.9/1), Pac-Man on dots (0.71/0.79/0.87), ghosts (0.75/0.85/0.95),
     * ghosts in the tunnel (0.4/0.45/0.5), Elroy 1 (0.8/0.9/1), Elroy 2
     * (0.85/0.95/1.05), frightened Pac-Man (0.9/0.95/1) and on dots
     * (0.79/0.83/0.87), and frightened ghosts (0.5/0.55/0.6). Sixteen values.
     * Note 1.05 in particular: Elroy 2 from level 5 on is the one fraction
     * above 100% the table actually contains.
     */
    const tableFractions = [
      0.4, 0.45, 0.5, 0.55, 0.6, 0.71, 0.75, 0.79, 0.8, 0.83, 0.85, 0.87, 0.9, 0.95, 1, 1.05,
    ];

    expect.assertions(tableFractions.length * 2);
    for (const fraction of tableFractions) {
      expect(Number.isInteger(speedSubPixels(fraction))).toBe(true);
      expect(speedSubPixels(fraction)).toBe(speedSubPixels(fraction));
    }
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: One boundary input, one line. A frozen actor is a real
   *   game state — Pac-Man stops for a few frames on eating a pellet — so zero
   *   must be an ordinary input rather than a special case somebody guards
   *   against with a minimum step of one sub-pixel.
   * MEASURES: That a zero fraction converts to a zero step.
   * ORACLE: Arcade behaviour: during the freeze frames after eating, an actor's
   *   speed is zero and it does not advance at all.
   * CATCHES: A conversion with a floor of 1 sub-pixel "so nothing ever gets
   *   stuck", which makes every freeze leak a pixel of drift.
   * LOAD-BEARING: no — the do-nothing stub returns 0 for everything, so this
   *   passes trivially. It is a guard, and it is honest to say so.
   */
  it('converts a zero speed to a zero step, because a frozen actor really does not move', () => {
    expect(speedSubPixels(0)).toBe(0);
  });
});
