/**
 * How long one arcade frame lasts, in milliseconds.
 *
 * The single definition of "a frame" in the whole game: gameplay timers,
 * fright countdowns and note durations are all counted in these. Sixty frames
 * per second, so 1000/60 — NOT the 16 that "60fps is about 16ms" tempts you
 * into, which would run the game 4% fast and desynchronise every wave timer.
 *
 * Written as the division rather than as a decimal, because the value does not
 * terminate: any literal would be a rounding decision made silently.
 */
export const FRAME_MS = 1000 / 60;

/**
 * The most frames one call to `advanceClock` will ever hand back.
 *
 * A background tab, a garbage-collection pause or a breakpoint can deliver
 * half a second in one go. Simulating all of it at once would freeze the
 * browser and teleport the ghosts, so the burst is capped and the excess is
 * dropped rather than banked.
 *
 * The value 5 is a judgement taken in this slice rather than an arcade fact:
 * it is the largest catch-up burst that still fits inside a single 16 ms frame
 * budget when one simulated frame costs well under 2 ms. It is a constant so
 * the decision is reviewable in one place.
 */
export const MAX_FRAMES_PER_STEP = 5;

/**
 * The whole answer to "how much of the game is due now?".
 *
 * Three fields rather than a bare frame count, and each earns its place. The
 * remainder is RETURNED rather than kept in a variable inside the clock, so the
 * caller banks it in `GameState.pendingMs` and `tick` stays a total function of
 * its arguments — which is what lets a test advance exactly ninety frames with
 * no clock anywhere. And the clamp is reported rather than swallowed, so a
 * caller can tell a stall from ordinary play instead of inferring it from a
 * suspiciously large frame count.
 */
export interface ClockAdvance {
  /** Whole frames now due. Never negative, never above MAX_FRAMES_PER_STEP. */
  readonly frames: number;
  /** Time received but not yet worth a whole frame. Carried into the next call. */
  readonly remainderMs: number;
  /** True when the burst was capped, so a caller can tell a stall from normal play. */
  readonly clamped: boolean;
}

/**
 * Convert wall-clock milliseconds into whole arcade frames.
 *
 * Total in its arguments: the same `pendingMs` and `deltaMs` always give the
 * same answer, with no hidden clock. That is what lets `tick` be a pure
 * reducer and a test advance time by an exact number of frames.
 *
 * Three decisions are visible in the four lines below. The leftover is BANKED,
 * because at a real 60 Hz display roughly half of all deltas fall a shade
 * short of a frame and discarding them would halve the game's speed. It is
 * banked by SUBTRACTING the frames actually spent rather than by `%`, so an
 * exact multiple leaves exactly nothing behind. And a delta that is negative or
 * NaN — both of which reach a requestAnimationFrame caller for real — is read
 * as zero by the single `> 0` test, so the bank can neither rewind nor be
 * poisoned.
 */
export function advanceClock(pendingMs: number, deltaMs: number): ClockAdvance {
  const totalMs = pendingMs + (deltaMs > 0 ? deltaMs : 0);
  const dueFrames = Math.floor(totalMs / FRAME_MS);
  const clamped = dueFrames > MAX_FRAMES_PER_STEP;
  const frames = clamped ? MAX_FRAMES_PER_STEP : dueFrames;

  /* The clamped path forgives the excess instead of banking it: a stall that
     ends must not be followed by seconds of double-speed catch-up. */
  return { frames, remainderMs: clamped ? 0 : totalMs - frames * FRAME_MS, clamped };
}
