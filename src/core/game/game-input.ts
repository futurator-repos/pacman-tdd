import { type Direction } from '../geometry/direction.ts';

/**
 * One frame's worth of player intent, sampled once and then immutable.
 *
 * The shell reads the keyboard whenever it likes; the core sees exactly one of
 * these per frame. That single sampling point is what makes a replay possible:
 * an array of `GameInput` plus a seed is a complete description of a game
 * (docs/ARCHITECTURE.md, "GameInput and Replay"), so a bug becomes a committed
 * JSON fixture rather than a paragraph of prose.
 *
 * Note the two kinds of field, because they are read differently:
 *
 *   - `direction` is a LEVEL. It says what is held down right now, so holding
 *     left through a corner keeps requesting left.
 *   - `startPressed` and `pausePressed` are EDGES. They are true on exactly the
 *     frame the key went down. A held Enter key must not restart the round
 *     sixty times a second, and the way to guarantee that is to make "went
 *     down" the only thing the core can observe.
 */
export interface GameInput {
  /** The direction currently held, or null. Sampled once per frame. */
  readonly direction: Direction | null;
  /** Edge-triggered: true only on the frame the key went down. */
  readonly startPressed: boolean;
  /** Edge-triggered: true only on the frame the key went down. */
  readonly pausePressed: boolean;
}

/**
 * The input that asks for nothing.
 *
 * Every test that is not about input uses this, which is the point: "advance
 * ninety frames with nobody touching the controls" should read as ninety
 * `NEUTRAL_INPUT`s and not as a hand-built literal repeated in forty files, one
 * of which will eventually get a `startPressed: true` by accident.
 *
 * It is a frozen module constant rather than a factory because `GameInput` is
 * deeply readonly: there is nothing to copy and nothing a caller could mutate.
 */
export const NEUTRAL_INPUT: GameInput = {
  direction: null,
  startPressed: false,
  pausePressed: false,
};
