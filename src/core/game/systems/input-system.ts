import { type GameEvent, NO_EVENTS } from '../game-event.ts';
import { type GameState } from '../game-state.ts';
import {
  type FrameContext,
  type System,
  type SystemResult,
  SystemId,
  unchanged,
} from '../system.ts';

/**
 * The frame's first step: write down what the player ASKED FOR, and nothing else.
 *
 * It runs first because everything after it wants the answer, and it is this
 * small because the interesting half of the job belongs to somebody else.
 * pacman-system mirrors `pendingDirection` into `actor.queued` and then asks
 * `pacmanTurnPolicy` whether the maze allows it — every pixel, until it does.
 * Splitting "what was asked for" from "what is permitted" is the whole of
 * docs/ARCADE-REFERENCE.md section 8.4: a queued direction "is retried every
 * pixel and applied at the first tile centre where it is legal, and it persists
 * indefinitely until it is taken or overwritten". A system that recorded a
 * request only when it was already legal would leave nothing to retry, and
 * cornering would demand frame-perfect input.
 *
 * Hence the two things this file conspicuously does NOT do:
 *
 *   - **It never consults the maze.** A direction into a wall is recorded like
 *     any other. Refusing it is the turn policy's business, and so is changing
 *     its mind three pixels later at the junction.
 *   - **A null direction is not an instruction.** `GameInput.direction` is a
 *     LEVEL, not an edge, so null means "no key is held down", which is not the
 *     same as "cancel". Every human turn has a frame or two of nothing between
 *     releasing one key and pressing the next; clearing the queue there would
 *     erase the turn the player had just asked for.
 */
export const inputSystem: System = {
  id: SystemId.Input,
  run(state: GameState, ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
    const requested = ctx.input.direction;
    /* Both cases mean "nothing changed", and both must return the SAME object:
       `runSystems` threads the state by reference and never copies it. Holding
       a direction that is already recorded is the ordinary case rather than an
       edge case — a key stays down for tens of frames — so rebuilding here
       would allocate a fresh world on most frames of a real game and quietly
       defeat every identity check downstream. */
    if (requested === null || requested === state.pacman.pendingDirection) {
      return unchanged(state);
    }
    return {
      state: { ...state, pacman: { ...state.pacman, pendingDirection: requested } },
      events: NO_EVENTS,
    };
  },
};
