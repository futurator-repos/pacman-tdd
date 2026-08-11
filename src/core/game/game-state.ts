import { type GhostId } from '../ghost/ghost-id.ts';
import { type Ghost } from '../ghost/ghost.ts';
import { type HouseState } from '../ghost/house.ts';
import { type PelletField } from '../maze/pellets.ts';
import { type Pacman } from '../pacman/pacman.ts';
import { type FruitState } from '../rules/fruit.ts';
import { type ModeState } from '../rules/mode-schedule.ts';

import { type RoundPhase } from './game-phase.ts';

/**
 * The whole world, in one readonly value.
 *
 * Every field is owned and documented by the slice that defines its type; this
 * file's job is only to say what a world CONSISTS of. That is why the imports
 * above read like a contents page — `Pacman` from `pacman/`, `PelletField` from
 * `maze/`, `HouseState` from `ghost/` — and why none of those modules imports
 * this one. State is assembled from the rules; the rules never reach back into
 * the state.
 *
 * Four absences are as much a part of the design as the fields that are
 * present:
 *
 *   - **No maze.** It is static, it is 868 tiles, and it would make every
 *     failed assertion unreadable. `mazeForLevel(state.level)` is the single
 *     lookup both `tick` and `buildScene` use, so the rules and the picture
 *     cannot disagree about which board is on screen.
 *   - **No functions and no class instances.** A `GameState` is data, so it
 *     `structuredClone`s and prints legibly in a diff. That is not tidiness: a
 *     failing assertion that prints a closure tells you nothing.
 *   - **No cycles.** Nothing points back up at the state that contains it.
 *   - **No derived fields.** Anything computable from these is computed, never
 *     stored, so there is no second copy to fall out of step.
 *
 * **On serialisation, precisely.** `structuredClone(state)` is exact; plain
 * `JSON.stringify` is NOT, because `PelletField` holds two `ReadonlySet`s and a
 * `Set` serialises to `{}`. docs/ARCHITECTURE.md asserts both "two ReadonlySets"
 * and "JSON round-trips", which cannot both be true; the sets win, because the
 * membership test they exist for happens 244 times a level, and nothing in this
 * design ever serialises a state to JSON — a `Replay` is `(seed, options,
 * inputs)`, which is exactly why it was defined that way. `new-game.test.ts`
 * pins the structural claim in the form that is actually true.
 *
 * And one presence that looks odd until you see what it buys: `pendingMs`.
 * Real time that has arrived but is not yet worth a whole frame is banked HERE
 * rather than in the animation loop, which is what makes `tick` a total
 * function of its arguments — the same state and the same deltaMs always give
 * the same result — and what lets a test say "advance exactly ninety frames"
 * without touching a clock.
 */
export interface GameState {
  readonly level: number;
  /**
   * Frames since the game began. Drives every animation, so the renderer never
   * needs a counter of its own — which is why two identical states always draw
   * identically.
   */
  readonly frame: number;
  readonly phase: RoundPhase;
  /** Frames left in a timed phase. Zero in `playing` and `gameOver`. */
  readonly phaseFramesLeft: number;
  readonly pacman: Pacman;
  /**
   * Always four, always keyed by `GhostId`. A record rather than an array:
   * under `noUncheckedIndexedAccess` an array index is `Ghost | undefined`,
   * while `ghosts[GhostId.Inky]` is a `Ghost` — and it reads better besides.
   */
  readonly ghosts: Readonly<Record<GhostId, Ghost>>;
  readonly pellets: PelletField;
  readonly fruit: FruitState;
  readonly modes: ModeState;
  readonly house: HouseState;
  readonly score: number;
  /** Session-scoped. There is no storage adapter: docs/ARCHITECTURE.md, "scope exclusions". */
  readonly highScore: number;
  /** The 10000-point bonus is awarded once per game. This is the latch. */
  readonly extraLifeAwarded: boolean;
  readonly lives: number;
  /** Real time received but not yet worth a whole frame. See the note above. */
  readonly pendingMs: number;
}
