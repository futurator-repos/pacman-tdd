import { type GameEvent } from '../game-event.ts';
import { type GameState } from '../game-state.ts';
import {
  type FrameContext,
  type System,
  type SystemResult,
  SystemId,
  unchanged,
} from '../system.ts';

/**
 * SIGNATURE-ONLY STUB — RED phase. No behaviour.
 * See docs/TDD-CHARTER.md, Challenge 1.
 */
export const eatSystem: System = {
  id: SystemId.Eat,
  run(state: GameState, _ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
    return unchanged(state);
  },
};
