import { isCleared } from '../../maze/pellets.ts';
import { type GameEvent } from '../game-event.ts';
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
 * The end of a round, decided once per frame.
 *
 * WHY IT ASKS `isCleared` RATHER THAN COUNTING FOR ITSELF. The rule that a level
 * ends when all 244 edible tiles are gone — dots AND energizers,
 * docs/ARCADE-REFERENCE.md section 8.1 — is already written, tested and green in
 * `maze/pellets.ts`. A system is a thin adapter: it decides WHEN a rule is
 * consulted and what the answer does to the state. The moment it re-derives the
 * rule there are two definitions of "cleared" in the codebase, and only one of
 * them is tested.
 *
 * WHY IT ENDS THE ROUND RATHER THAN STARTING THE NEXT LEVEL. Clearing the board
 * does not put Pac-Man on the next level; it puts the board he just emptied on
 * screen, flashing, for 120 frames (section 7.2). The next level begins when
 * that flash ENDS, which is a timed transition and therefore the phase system's
 * business. Advancing the level here would refill the maze with 244 fresh dots
 * and then flash THAT — the player watching a full board celebrate being empty.
 *
 * WHY IT RUNS LATE. It sits after `eat` and after both collision passes
 * (`GAME_PIPELINE`, slice s12), because the last pellet of a level is eaten in
 * this same frame: asking any earlier would be asking about the previous frame's
 * board, and every level would end one frame late.
 */
export const levelSystem: System = {
  id: SystemId.Level,
  run(state: GameState, _ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
    /* The phase test is not a formality. The board stays empty for every one of
       the 120 flashing frames, so without it this transition fires again on each
       of them: the countdown is reloaded to 120 forever, the flash never ends,
       and one `levelCleared` a frame pours down the audio channel. */
    if (state.phase !== RoundPhase.Playing || !isCleared(state.pellets)) {
      return unchanged(state);
    }
    return {
      state: {
        ...state,
        phase: RoundPhase.LevelComplete,
        phaseFramesLeft: PHASE_FRAMES[RoundPhase.LevelComplete],
      },
      /* The level that ENDED, not the one about to begin: an event reports what
         happened, and what happened was the end of `state.level`. The phase
         change itself needs no event from here — it is in the state, which is
         the render channel, and the phase system announces the transitions it
         owns. One occurrence, one event. */
      events: [{ kind: 'levelCleared', level: state.level }],
    };
  },
};
