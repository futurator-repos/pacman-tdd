import { GhostPhase } from '../../ghost/ghost.ts';
import { houseAfterDot, houseAfterFrame, releaseDecision } from '../../ghost/house.ts';
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
 * The door of the ghost house, opened at most once per frame.
 *
 * WHY IT OWNS NO RULE OF ITS OWN. Every number the house runs on —
 * the level-1 limits of 0/30/60, the 7/17/32 ladder after a death, the four
 * seconds that break a stalemate (docs/ARCADE-REFERENCE.md section 12) — is
 * already written and green in `ghost/house.ts`. This file decides only WHEN
 * those rules are consulted and what their answer does to the world. The moment
 * it re-derived one of them there would be two definitions of "Inky may leave",
 * and only one of them would be tested.
 *
 * WHY THE DOT ARRIVES AS AN EVENT. The counters advance on dots, and the system
 * that knows a dot was eaten is the eat system, which ran earlier in this same
 * frame. It says so with `pelletEaten`, and `incoming` is the only channel
 * between systems — so this file never looks at `state.pellets`. Comparing
 * pellet counts here would mean the house needed to remember the previous
 * frame's board, which is precisely the second source of truth the event
 * channel exists to avoid.
 *
 * WHY IT RUNS BEFORE THE GHOSTS MOVE. In `GAME_PIPELINE` (slice s12) the house
 * sits between `mode` and `ghost`, so a ghost released this frame takes its
 * first step out of the door in the SAME frame rather than standing still for
 * one. It also means the release is decided from the mode the ghosts are about
 * to move under, not the previous one.
 */
export const houseSystem: System = {
  id: SystemId.House,

  /**
   * One frame of the house: age the clock, then ask who may leave.
   *
   * The order of the three steps is the behaviour, and each one is a bug if it
   * moves:
   *
   * 1. **Only `playing` runs the clock.** The READY! pause, the death freeze
   *    and the maze flash are phases in which time passes and the world does
   *    not (section 7). Left running, the 180 frames of the death animation
   *    plus the 120 of the following READY! would trip the four-second release
   *    twice over, and the player would watch a ghost stroll out of the house
   *    while Pac-Man was still spinning. The early return is `unchanged(state)`
   *    — the same object, never a copy — because `runSystems` threads the state
   *    by reference and the identity is asserted.
   * 2. **The clock is aged BEFORE the decision, not after.** The house handed to
   *    `releaseDecision` is this frame's, so the 240th frame without a dot
   *    releases a ghost ON the 240th frame. Deciding first and ageing afterwards
   *    is a one-line difference that delays every release in the game by a frame
   *    — and delays it at the moment it matters most, the re-entry after a
   *    death.
   * 3. **A dot resets the timer rather than adding to it.** `houseAfterDot`
   *    runs on top of the aged house, which lands on zero either way: the two
   *    transitions compose in this order and only this order, because "no dot
   *    for N frames" is false the instant a dot arrives.
   *
   * At most one ghost changes phase, because `releaseDecision` names at most one
   * (section 12.4). The only field touched is the phase: `InHouse` becomes
   * `LeavingHouse` and the ghost system walks it out through the gate from
   * there. `dotCounterActive` is deliberately left alone for the reason
   * `house.ts` gives — the phase already says whether a ghost is waiting, and a
   * second flag saying the same thing is a second thing to keep in step.
   */
  run(state: GameState, _ctx: FrameContext, incoming: readonly GameEvent[]): SystemResult {
    if (state.phase !== RoundPhase.Playing) {
      return unchanged(state);
    }

    const aged = houseAfterFrame(state.house);
    const house = incoming.some((event) => event.kind === 'pelletEaten')
      ? houseAfterDot(aged)
      : aged;

    const released = releaseDecision({ house, ghosts: state.ghosts, level: state.level });
    if (released === null) {
      return { state: { ...state, house }, events: NO_EVENTS };
    }

    return {
      state: {
        ...state,
        house,
        ghosts: {
          ...state.ghosts,
          [released]: { ...state.ghosts[released], phase: GhostPhase.LeavingHouse },
        },
      },
      /* One occurrence, one event. The phase change itself needs no announcing —
         it is in the state, which is the render channel — but "a ghost came out
         of the house" is a thing that HAPPENED, and the siren has no other way
         to hear it. */
      events: [{ kind: 'ghostReleased', ghost: released }],
    };
  },
};
