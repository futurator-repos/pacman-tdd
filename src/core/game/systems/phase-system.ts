import { type GameEvent, NO_EVENTS } from '../game-event.ts';
import { PHASE_FRAMES, RoundPhase } from '../game-phase.ts';
import { type GameState } from '../game-state.ts';
import {
  type FrameContext,
  type System,
  type SystemResult,
  SystemId,
  unchanged,
} from '../system.ts';

/**
 * Where a timed phase goes when its countdown runs out.
 *
 * A total `Record` rather than a `switch` or a `Partial`, for the same reason
 * `PHASE_FRAMES` is one: a sixth phase becomes a COMPILE error here, in the one
 * place a successor must be decided, rather than a silent `default` that strands
 * the new phase forever. A `Partial` would type the lookup as
 * `RoundPhase | undefined` and so demand a fallback that no situation can reach.
 *
 * The two untimed rows name themselves. `playing` and `gameOver` have no
 * countdown to run out (`PHASE_FRAMES` gives them 0), so those rows are never
 * read; saying "it stays where it is" is the only honest thing they could say.
 *
 * `dying` goes to `ready`, not to `playing`: the player gets the READY! pause to
 * see the board again before the ghosts start moving, which is the difference
 * between a fair game and an instant second death. Whether there is a life left
 * to spend is not asked here — `loseLife` already asked it at the moment of the
 * catch, so a `dying` phase only ever exists when a respawn is coming.
 */
const NEXT_PHASE: Readonly<Record<RoundPhase, RoundPhase>> = {
  [RoundPhase.Ready]: RoundPhase.Playing,
  [RoundPhase.Playing]: RoundPhase.Playing,
  [RoundPhase.Dying]: RoundPhase.Ready,
  [RoundPhase.LevelComplete]: RoundPhase.Ready,
  [RoundPhase.GameOver]: RoundPhase.GameOver,
};

/**
 * Owns the round phase and the countdown attached to it.
 *
 * It runs second, right after input, because every system after it decides what
 * to do by reading `state.phase` — so the phase must be this frame's answer, not
 * last frame's. It is also the only place a phase may change on its own: a
 * countdown is the one cause that is nobody else's news. Deaths, cleared boards
 * and start presses arrive from the systems that detect them.
 *
 * "Zero frames left" is the whole gate. `PHASE_FRAMES` uses 0 to mean "no
 * timer", and a timed phase is never left sitting on 0 — the frame that spends
 * its last one also moves it on and reloads the successor's duration. So a zero
 * here always means "this phase ends because something happens, not because a
 * counter ran out", and the system returns the state object untouched rather
 * than a copy of it.
 */
export const phaseSystem: System = {
  id: SystemId.Phase,
  run(state: GameState, _ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
    if (state.phaseFramesLeft === 0) {
      return unchanged(state);
    }

    const framesLeft = state.phaseFramesLeft - 1;
    if (framesLeft > 0) {
      return { state: { ...state, phaseFramesLeft: framesLeft }, events: NO_EVENTS };
    }

    /* The event is the only way anything else can hear about this. The audio
       director stops the READY! jingle on it without importing this module. */
    const phase = NEXT_PHASE[state.phase];
    return {
      state: { ...state, phase, phaseFramesLeft: PHASE_FRAMES[phase] },
      events: [{ kind: 'phaseChanged', phase }],
    };
  },
};
