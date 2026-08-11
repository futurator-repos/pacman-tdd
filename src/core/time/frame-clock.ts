/**
 * SIGNATURE-ONLY STUB — RED phase.
 *
 * Real types, inert values, no behaviour, so the tests fail on their own
 * assertions rather than on a missing module. See docs/TDD-FINDINGS.md.
 */

/**
 * How long one arcade frame lasts, in milliseconds.
 *
 * The single definition of "a frame" in the whole game: gameplay timers,
 * fright countdowns and note durations are all counted in these. Sixty frames
 * per second, so 1000/60 — NOT the 16 that "60fps is about 16ms" tempts you
 * into, which would run the game 4% fast and desynchronise every wave timer.
 */
export const FRAME_MS = 0;

/**
 * The most frames one call to `advanceClock` will ever hand back.
 *
 * A background tab, a garbage-collection pause or a breakpoint can deliver
 * half a second in one go. Simulating all of it at once would freeze the
 * browser and teleport the ghosts, so the burst is capped and the excess is
 * dropped rather than banked.
 */
export const MAX_FRAMES_PER_STEP = 0;

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
 */
export function advanceClock(_pendingMs: number, _deltaMs: number): ClockAdvance {
  return { frames: 0, remainderMs: 0, clamped: false };
}
