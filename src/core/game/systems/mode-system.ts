import { GhostId } from '../../ghost/ghost-id.ts';
import { type Ghost } from '../../ghost/ghost.ts';
import { advanceModes, currentMode } from '../../rules/mode-schedule.ts';
import { type GameEvent, NO_EVENTS } from '../game-event.ts';
import { RoundPhase } from '../game-phase.ts';
import { type GameState } from '../game-state.ts';
import {
  type FrameContext,
  type System,
  type SystemResult,
  SystemId,
  unchanged,
} from '../system.ts';

/**
 * Mark one ghost as owing the maze a turn.
 *
 * The flag rather than an immediate `opposite(facing)`, because a ghost caught
 * mid-tile would otherwise walk backwards out of a tile it has half entered.
 * The turn is taken at the next tile centre by the ghost system, which is the
 * only place that knows where a centre is.
 */
function queueReversal(ghost: Ghost): Ghost {
  return { ...ghost, reverseQueued: true };
}

/**
 * Every ghost owes the maze a turn, including the ones that will refuse.
 *
 * Written as four named keys rather than a loop over `Object.entries`, for two
 * reasons that both cost nothing here. The result stays a
 * `Record<GhostId, Ghost>` to the compiler — a rebuilt-by-loop record is a
 * partial one until it is cast, and a cast is exactly where the fourth ghost
 * goes missing. And the flag is visibly set on all four, which is the defect
 * the test for this exists to catch: set it inside a loop that ends early and
 * three ghosts keep walking away from a hunt that has already started.
 *
 * No ghost is exempted HERE. A ghost in the house and a pair of eyes on its way
 * home both get the flag; whether acting on it makes sense is a question about
 * navigating the maze, and it is answered where the navigation happens
 * (docs/ARCADE-REFERENCE.md section 4, "Reversal").
 */
function queueReversalOnEveryGhost(ghosts: GameState['ghosts']): GameState['ghosts'] {
  return {
    [GhostId.Blinky]: queueReversal(ghosts[GhostId.Blinky]),
    [GhostId.Pinky]: queueReversal(ghosts[GhostId.Pinky]),
    [GhostId.Inky]: queueReversal(ghosts[GhostId.Inky]),
    [GhostId.Clyde]: queueReversal(ghosts[GhostId.Clyde]),
  };
}

/**
 * The wave clock and the fright timer, advanced by exactly one frame.
 *
 * All the arithmetic lives in `advanceModes` (`rules/mode-schedule.ts`), which
 * is pinned against the three arcade tables. This system's whole job is the
 * three things a rule module cannot do for itself: decide WHEN the rule is
 * allowed to run, translate its `reversalRequired` edge onto the ghosts, and
 * turn its two edges into events.
 *
 * **It runs while the round is playing and at no other time.** The pauses are
 * real time in which the world does not move (docs/ARCADE-REFERENCE.md section
 * 7.2), and the wave clock is part of the world: left ungated, the 120-frame
 * READY! countdown would silently spend 2 of the opening scatter's 7 seconds
 * before the player had moved, and the 180-frame death pause would eat a third
 * of the fright the next round is owed. Outside `playing` the state object is
 * returned untouched rather than copied — see `unchanged` in `system.ts`.
 *
 * **The two edges are mutually exclusive**, which is why this reads as three
 * exits rather than an events array being pushed into: `advanceModes` returns
 * from the fright branch before it ever looks at the wave clock, so no frame
 * can both end fright and flip a wave. Saying that with control flow means
 * there is no ordering between the two events to get wrong.
 */
export const modeSystem: System = {
  id: SystemId.Mode,
  run(state: GameState, ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
    if (state.phase !== RoundPhase.Playing) {
      return unchanged(state);
    }

    const advance = advanceModes(state.modes, ctx.spec);

    if (advance.reversalRequired) {
      return {
        state: {
          ...state,
          modes: advance.modes,
          ghosts: queueReversalOnEveryGhost(state.ghosts),
        },
        /* The NEW mode and the NEW index: the event says what the ghosts are
           doing from this frame on, which is what the siren and the HUD need.
           Reading `currentMode` off the advanced state rather than recomputing
           it here keeps the schedule the single owner of that lookup. */
        events: [
          {
            kind: 'modeChanged',
            mode: currentMode(advance.modes, ctx.spec),
            waveIndex: advance.modes.waveIndex,
          },
        ],
      };
    }

    if (advance.frightenedEnded) {
      /* Nobody reverses: fright ENDING is absent from the Dossier's list of
         reversal triggers (section 4, "Reversal"). */
      return { state: { ...state, modes: advance.modes }, events: [{ kind: 'frightenedEnded' }] };
    }

    return { state: { ...state, modes: advance.modes }, events: NO_EVENTS };
  },
};
