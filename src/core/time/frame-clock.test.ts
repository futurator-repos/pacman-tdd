import { describe, expect, it } from 'vitest';

import { advanceClock, FRAME_MS, MAX_FRAMES_PER_STEP } from './frame-clock.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The arcade had one clock: the display's 60 Hz vertical blank. Every rule in
 * the game is counted in those frames — fright lasts 360 of them at level 1, a
 * scatter wave 420, Pac-Man's speed is expressed as a fraction of a fixed
 * distance per frame. A browser has no such clock. It hands you a delta of
 * whatever elapsed: 16.7 ms on a good frame, 33 on a dropped one, 500 after a
 * background tab, occasionally a negative one after a clock adjustment.
 *
 * This module is the only place that conversion happens, and it is the reason
 * a 30 fps laptop and a 144 fps desktop play the SAME game rather than one at
 * half speed and one at double. It is also what lets a test say "advance
 * exactly ninety frames" without touching a clock at all: `advanceClock` is a
 * total function of its two arguments, so the leftover milliseconds live in
 * GameState.pendingMs rather than in a hidden variable inside a loop.
 *
 * Note what these tests never do: no fake timers, no setTimeout, no waiting.
 * Time is a parameter. That is a design decision paying for itself — see
 * docs/TDD-FINDINGS.md, "testability is an architecture decision".
 */

describe('FRAME_MS', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: one constant, one exact value. Nothing cheaper exists and
   *   nothing more expensive would say more.
   * MEASURES: the length of one arcade frame in milliseconds.
   * ORACLE: docs/ARCHITECTURE.md's stated decision — the game runs at 60
   *   frames per second, so one frame is 1000/60 ms = 16.666... The value is
   *   written as the division rather than as a decimal literal precisely
   *   because it does not terminate.
   * CATCHES: the "60 fps is about 16 ms" shortcut. A 16 ms frame runs the
   *   whole game 4.2% fast: every fright timer, every scatter wave and every
   *   note in the music drifts, and it drifts consistently enough that nobody
   *   notices until the level-1 wave table is compared against the ROM.
   * LOAD-BEARING: yes — the stub declares 0.
   */
  it('is one sixtieth of a second, not the 16 ms that "60 fps" tempts you into', () => {
    expect(FRAME_MS).toBe(1000 / 60);
    expect(FRAME_MS).not.toBe(16);
  });
});

describe('advanceClock', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: one call, three exact fields. The behaviour is arithmetic
   *   on two numbers, so a unit test states it completely.
   * MEASURES: that a delta smaller than one frame yields no frames and is
   *   BANKED rather than dropped.
   * ORACLE: docs/ARCHITECTURE.md s01 — "advanceClock(0, 16) yields 0 frames
   *   and banks the remainder". 16 < 16.666..., so no whole frame is due yet
   *   and all 16 ms carry forward.
   * CATCHES: dropping the sub-frame remainder. At a real 60 Hz display the
   *   delta is a shade under one frame about half the time, so a clock that
   *   discarded the leftover would lose roughly half of all frames and the
   *   game would run at about half speed — while every individual test of
   *   every rule still passed.
   * LOAD-BEARING: yes — the stub reports 0 frames (which passes) but a
   *   remainder of 0 (which does not). The frames assertion alone would have
   *   been a weak test; the remainder is what gives this one teeth.
   */
  it('yields no frame for a delta shorter than one frame, and banks it', () => {
    expect(advanceClock(0, 16)).toEqual({ frames: 0, remainderMs: 16, clamped: false });
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: three chained calls — the point is what happens ACROSS
   *   calls, which a single call cannot show. Still a unit: one module, no
   *   collaborators, no clock.
   * MEASURES: that three deltas of 6 ms accumulate — 0 frames, 0 frames, then
   *   one frame at 18 ms — and that the leftover after that frame is exactly
   *   the 18 ms received minus the one frame spent.
   * ORACLE: docs/ARCHITECTURE.md s01 — "advanceClock accumulates sub-frame
   *   deltas until a whole frame is due". 6 + 6 + 6 = 18 > 16.666..., so
   *   exactly one frame is due and 1.333... ms remains. The expected remainder
   *   is written as `18 - FRAME_MS` rather than as a decimal because one frame
   *   is not exactly representable in binary floating point: the claim being
   *   pinned is "exactly one frame's worth was taken out", and that is what
   *   the expression says.
   * CATCHES: a clock that resets its accumulator on every call. The game would
   *   then advance only when a single delta happened to exceed a whole frame,
   *   so it would run correctly at 30 fps and freeze solid at 144 fps.
   * LOAD-BEARING: yes — the stub never banks anything, so the second and third
   *   calls both fail.
   */
  it('accumulates sub-frame deltas across calls until a whole frame is due', () => {
    const first = advanceClock(0, 6);
    expect(first).toEqual({ frames: 0, remainderMs: 6, clamped: false });

    const second = advanceClock(first.remainderMs, 6);
    expect(second).toEqual({ frames: 0, remainderMs: 12, clamped: false });

    const third = advanceClock(second.remainderMs, 6);
    expect(third.frames).toBe(1);
    expect(third.clamped).toBe(false);
    expect(third.remainderMs).toBe(18 - FRAME_MS);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: one call at the exact multiple where floating-point error
   *   would show. The interesting input is a single specific value, so a
   *   property test would only be a slower way to reach it.
   * MEASURES: that exactly three frames' worth of time yields exactly 3
   *   frames and exactly no remainder — not 2 frames and 16.67 ms left over.
   * ORACLE: docs/ARCHITECTURE.md s01 — "advanceClock(0, 1000/60 * 3) yields
   *   exactly 3 frames and a remainder of 0 (no off-by-one from float error)".
   * CATCHES: an accumulator that leaks a whole frame at an exact multiple —
   *   for instance one taking its remainder with `%` rather than subtracting
   *   the frames it spent, which answers 3 frames but hands back 16.666... ms
   *   instead of 0 and so runs the game a frame behind from then on.
   *   HONEST LIMIT: the classic float off-by-one (2.9999999999999996 floored
   *   to 2) does NOT bite at three frames — 3*(1000/60) is exactly 50 and
   *   50/(1000/60) is exactly 3 in binary floating point. The first multiples
   *   where it does bite are 63, 123, 126, ... , all far above
   *   MAX_FRAMES_PER_STEP, so the clamp below puts them out of reach. This
   *   test pins the exact-multiple case; it does not prove the float case.
   * LOAD-BEARING: yes — the stub reports 0 frames.
   */
  it('yields exactly three frames and no remainder for exactly three frames of time', () => {
    expect(advanceClock(0, FRAME_MS * 3)).toEqual({
      frames: 3,
      remainderMs: 0,
      /* Asserted here as well as in the clamp test below, so an implementation
         that reports `clamped: true` unconditionally cannot survive. */
      clamped: false,
    });
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: one call with a deliberately extreme input. The rule is a
   *   threshold, and a threshold is stated by an example on the far side of
   *   it.
   * MEASURES: that half a second arriving in one delta produces
   *   MAX_FRAMES_PER_STEP frames and no more, that the clamp is REPORTED, and
   *   that the excess time is discarded rather than banked.
   * ORACLE: docs/ARCHITECTURE.md s01 — "A 500 ms stall is clamped to
   *   MAX_FRAMES_PER_STEP frames rather than producing thirty catch-up frames;
   *   the clamp is reported so a caller can tell a stall from normal play."
   *   Note honestly what that sentence does NOT give: it names the constant but
   *   not its value. The literal 5 is therefore a decision taken here, in this
   *   slice — the weakest class of oracle (a judgement, not an external fact) —
   *   chosen as the largest burst that still fits inside a single 16 ms frame
   *   budget when each simulated frame costs well under 2 ms. It is asserted as
   *   a literal so the decision is visible and reviewable rather than implied,
   *   and it belongs in docs/ARCHITECTURE.md s01 alongside the sentence above.
   * CATCHES: two bugs at once. Without the cap, one stall runs 29 frames of
   *   simulation in a single callback: the ghosts teleport, Pac-Man walks into
   *   a wall he had already turned away from, and the browser janks harder,
   *   which makes the next delta bigger still. And without DROPPING the
   *   excess, the 460 discarded milliseconds would sit in pendingMs and be
   *   paid back over the following seconds — a stall that ends, followed by a
   *   game running at double speed to catch up.
   * LOAD-BEARING: yes — the stub reports 0 frames and clamped false. Note the
   *   constant is asserted against the literal 5 rather than against itself:
   *   `expect(frames).toBe(MAX_FRAMES_PER_STEP)` would pass against the stub,
   *   where both sides are 0.
   */
  it('clamps a long stall to five frames, reports the clamp, and forgives the rest', () => {
    expect(MAX_FRAMES_PER_STEP).toBe(5);
    expect(advanceClock(0, 500)).toEqual({ frames: 5, remainderMs: 0, clamped: true });
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: one call per bad input, each stating what the module does
   *   with it. Two separate `it`s rather than one, because an implementation
   *   that guards against negatives and forgets NaN is exactly the plausible
   *   half-fix, and it should fail with a message that names which half.
   * MEASURES: that a negative delta advances nothing and leaves the banked
   *   time untouched — it does not subtract, and it does not clear the bank.
   * ORACLE: docs/ARCHITECTURE.md s01 — "A negative or NaN deltaMs is treated
   *   as zero rather than rewinding the game." A negative delta reaches
   *   requestAnimationFrame callers for real, when the system clock steps
   *   backwards.
   * CATCHES: a negative delta driving pendingMs negative, which then swallows
   *   the next several real deltas — the game freezes for a moment and
   *   resumes, with nothing in any log to explain it.
   * LOAD-BEARING: yes. Note the deliberate non-zero pendingMs of 10: with
   *   pendingMs 0 the expected result would be {0, 0, false}, which is exactly
   *   what the do-nothing stub returns, and the test would pass while
   *   specifying nothing.
   */
  it('treats a negative delta as zero rather than rewinding the game', () => {
    expect(advanceClock(10, -100)).toEqual({ frames: 0, remainderMs: 10, clamped: false });
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: as above. See that block for the shared reasoning.
   * MEASURES: that a NaN delta advances nothing and leaves the banked time
   *   intact and still a number.
   * ORACLE: docs/ARCHITECTURE.md s01, same sentence as the negative case.
   * CATCHES: NaN poisoning. `pendingMs + NaN` is NaN, every comparison against
   *   NaN is false, so the game stops advancing permanently and every
   *   subsequent state field that touches pendingMs becomes NaN too. The
   *   symptom — "the game froze" — is miles from the cause.
   * LOAD-BEARING: yes, for the same reason as the negative case: the banked 10
   *   ms must survive.
   */
  it('treats a NaN delta as zero rather than poisoning the banked time', () => {
    expect(advanceClock(10, Number.NaN)).toEqual({ frames: 0, remainderMs: 10, clamped: false });
  });
});
