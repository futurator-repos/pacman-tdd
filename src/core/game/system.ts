import { type Maze } from '../maze/maze.ts';
import { type Rng } from '../rng/rng.ts';
import { type LevelSpec } from '../rules/level-spec.ts';

import { type GameEvent, NO_EVENTS } from './game-event.ts';
import { type GameInput } from './game-input.ts';
import { type GameState } from './game-state.ts';

/**
 * One shape, twelve implementations, and the fold that runs them.
 *
 * The uniformity IS the trick. Because every system has the same signature, the
 * game's entire control flow is a plain array (`GAME_PIPELINE`, slice s12) and
 * one fold — so the order in which things happen is a value you can read and a
 * test can pin, rather than folklore buried in the call order inside somebody's
 * `update()`. That is the single most common invisible bug factory in a game
 * loop, and here it is one array and one diff line.
 */

/**
 * The name of each step of a frame.
 *
 * Giving a system an id costs nothing and buys the pinning test in slice s12:
 * `GAME_PIPELINE.map(s => s.id)` equals a literal list, so a reorder is a
 * failing test with a readable diff instead of a mystery bug three weeks later.
 *
 * **Collision appears twice on purpose.** Once after Pac-Man moves and once
 * after the ghosts move: that is what reproduces the arcade's famous
 * pass-through, where Pac-Man and a ghost swap tiles in one frame and survive
 * each other. Two ids rather than one flag, so the pipeline says it out loud.
 */
export const SystemId = {
  Input: 'input',
  Phase: 'phase',
  Pacman: 'pacman',
  Eat: 'eat',
  CollisionEarly: 'collision-early',
  Mode: 'mode',
  House: 'house',
  Ghost: 'ghost',
  CollisionLate: 'collision-late',
  Fruit: 'fruit',
  Level: 'level',
  Life: 'life',
} as const;

export type SystemId = (typeof SystemId)[keyof typeof SystemId];

/**
 * Everything a system may know that is not in the state.
 *
 * Note what is absent: no clock, no DOM, no `Math.random`. Time arrives as a
 * count of frames and randomness arrives as an injected `Rng`, which is what
 * makes a replay exact. The maze is here rather than in the state because it is
 * static; the `LevelSpec` is here so that no system anywhere branches on the
 * level number itself.
 */
export interface FrameContext {
  readonly maze: Maze;
  readonly spec: LevelSpec;
  readonly input: GameInput;
  readonly rng: Rng;
}

/** What one system, or one whole frame, produces. */
export interface SystemResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * One step of a frame.
 *
 * `incoming` is every event emitted EARLIER in this same frame, and it is the
 * only channel between systems. It is how the life system hears about a death
 * without importing the collision system, and how the audio decision hears
 * about everything without importing anything. Systems are therefore ordered,
 * but not coupled.
 */
export interface System {
  readonly id: SystemId;
  run(state: GameState, ctx: FrameContext, incoming: readonly GameEvent[]): SystemResult;
}

/**
 * "Nothing happened here."
 *
 * A named helper rather than an inline object literal at eleven call sites,
 * because the identity of the returned state matters: it must be the SAME
 * object, not a copy. See `runSystems` below.
 */
export function unchanged(state: GameState): SystemResult {
  return { state, events: NO_EVENTS };
}

/**
 * Run systems in order, threading the state and accumulating the events.
 *
 * Two properties this must have, both of which have their own test:
 *
 * 1. **Events accumulate in emission order**, and each system is handed
 *    everything emitted before it. The order of the returned array is the
 *    order things happened in, which is what makes it usable as an audio
 *    script.
 * 2. **A system that changes nothing costs nothing.** The state object is
 *    threaded through by reference, never defensively copied, so the result of
 *    a frame in which nothing moved is the very object that went in. A `{
 *    ...state }` in here would be invisible in every value assertion and would
 *    quietly defeat every `toBe` identity check downstream.
 *
 * RED PHASE: this returns its arguments untouched — no system is ever run.
 */
export function runSystems(
  _systems: readonly System[],
  state: GameState,
  _ctx: FrameContext,
): SystemResult {
  return { state, events: NO_EVENTS };
}
