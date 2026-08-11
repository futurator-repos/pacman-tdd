import { type GameEvent } from '../game-event.ts';
import { type GameState } from '../game-state.ts';
import {
  type FrameContext,
  type System,
  type SystemResult,
  type SystemId,
  unchanged,
} from '../system.ts';

/**
 * SIGNATURE-ONLY STUB — RED phase. No behaviour.
 *
 * A factory, not a constant: the pipeline installs collision TWICE, once after
 * Pac-Man moves and once after the ghosts move. That pair reproduces the
 * arcade's pass-through, where Pac-Man and a ghost swap tiles in one frame and
 * both survive.
 */
export function createCollisionSystem(
  id: typeof SystemId.CollisionEarly | typeof SystemId.CollisionLate,
): System {
  return {
    id,
    run(state: GameState, _ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
      return unchanged(state);
    },
  };
}
