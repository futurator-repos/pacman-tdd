import { ARCADE_MAZE } from '../../maze/arcade-maze.ts';
import { createRng } from '../../rng/rng.ts';
import { levelSpec } from '../../rules/level-table.ts';
import { NEUTRAL_INPUT, type GameInput } from '../game-input.ts';
import { type FrameContext } from '../system.ts';

/**
 * The context every system test needs, with the boring parts filled in.
 *
 * This exists because a `FrameContext` has four fields and eleven system test
 * files need one. Hand-building it in each of them would mean eleven places to
 * update when the shape changes, and — worse — eleven subtly different mazes,
 * so a test could pass or fail for reasons that have nothing to do with the
 * system under test.
 *
 * The default is the real arcade maze at level 1, because a system is a thin
 * adapter over rules that are already proven against the real board; using a
 * toy maze here would only test the toy.
 */
export function frameContext(overrides: Partial<FrameContext> = {}): FrameContext {
  return {
    maze: ARCADE_MAZE,
    spec: levelSpec(1),
    input: NEUTRAL_INPUT,
    /* A fixed seed rather than a scripted Rng: most systems never draw, and the
       ones that do have their own tests with an exact script. What matters here
       is only that the same test run twice gives the same answer. */
    rng: createRng(1),
    ...overrides,
  };
}

/** `frameContext` with a direction held down, which is most input tests. */
export function inputHolding(direction: GameInput['direction']): GameInput {
  return { ...NEUTRAL_INPUT, direction };
}
