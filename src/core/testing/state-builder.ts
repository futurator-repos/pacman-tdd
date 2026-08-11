import { PHASE_FRAMES, RoundPhase } from '../game/game-phase.ts';
import { type GameState } from '../game/game-state.ts';
import { startGame } from '../game/new-game.ts';

/**
 * The fixture builder: a legal `GameState` from the three fields a test cares
 * about.
 *
 * This file is production code, not a test helper hiding in `src/`, and it is
 * held to the same 100% coverage bar as the rules (docs/ARCHITECTURE.md,
 * "src/core/testing/ as first-class production code"). The reason is worth
 * stating plainly: **this function shapes every system test in slices s10 and
 * s11.** If it produces a subtly illegal world — a ghost outside the maze, a
 * pellet count that disagrees with the board — then twenty tests are asserting
 * things about a situation that cannot occur, and all of them pass.
 *
 * What it is for. A system test wants to say "a game in which Pac-Man is here,
 * with thirty dots left" and then assert one outcome. Without a builder that
 * sentence costs forty hand-written fields, of which thirty-nine are noise that
 * hides the one that matters — and the next test copy-pastes all forty. With
 * it, the patch a test writes IS the situation the test is about, and a reader
 * sees the whole setup in three lines.
 *
 * What it is NOT for. It does not invent rules. Its base is a real started
 * game, so the only thing a test can be wrong about is the patch it wrote.
 */

/**
 * A patch that may go as deep as the state does.
 *
 * The recursion is what makes `{ ghosts: { inky: { phase: 'hunting' } } }` a
 * legal patch that leaves Inky's position and the other three ghosts alone.
 *
 * Collections are taken WHOLE rather than merged element by element, and both
 * exceptions are load-bearing rather than tidy:
 *
 *   - **Arrays.** A test that says "these are the dots left" means exactly
 *     those. A half-merged array would be a genuinely confusing thing to debug.
 *   - **Sets.** `PelletField` holds `ReadonlySet`s, and without this branch the
 *     mapped type would recurse into `Set`'s own METHODS and produce a patch
 *     type demanding `add`, `has` and `forEach`. The error surfaces at the call
 *     site, miles from the cause, so the branch is here before anyone meets it.
 */
type DeepPatch<T> = {
  readonly [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends ReadonlySet<unknown>
      ? T[K]
      : T[K] extends object
        ? DeepPatch<T[K]>
        : T[K];
};

export type StatePatch = DeepPatch<GameState>;

/**
 * The one shape the merge below can reason about at runtime.
 *
 * The types above describe the patch precisely; the merge cannot, because it
 * walks keys it has never heard of. Rather than smear `unknown` through the
 * recursion with a cast at every step, the whole traversal works in this one
 * type and the two casts happen at the single boundary in `buildState` — where
 * the type system's claim ("a patch has the shape of the state") is handed over
 * to a function that only knows about records.
 */
type UnknownRecord = Readonly<Record<string, unknown>>;

/**
 * Is this a value the merge should descend INTO, rather than replace?
 *
 * The prototype test is what makes the Set and array exceptions of `DeepPatch`
 * true at runtime as well as in the types, and it does it without naming either:
 * a `Set` or an `Array` fails `=== Object.prototype`, so it is copied whole. A
 * pair of `instanceof` checks would say the same thing in more places and would
 * need extending for every collection anybody adds later.
 *
 * `Reflect.getPrototypeOf` rather than `Object.getPrototypeOf` because the
 * latter is typed `(o: any) => any` in the standard library, and `any` is
 * banned here for exactly the reason it would apply: it would silence the
 * checks on the comparison that follows.
 */
function isMergeable(value: unknown): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Merge `patch` into `base`, descending wherever both sides are records.
 *
 * The shallow alternative — `{ ...base, ...patch }` — is the bug this function
 * exists to prevent: it replaces the WHOLE `ghosts` record with the single
 * ghost a patch mentioned, and the symptom arrives four files away as "Blinky
 * is undefined" pointing at code that is perfectly correct.
 */
function deepMerge(base: UnknownRecord, patch: UnknownRecord): UnknownRecord {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const existing = merged[key];
    merged[key] = isMergeable(existing) && isMergeable(value) ? deepMerge(existing, value) : value;
  }
  return merged;
}

/**
 * A legal `GameState`, with the fields in `patch` overridden at any depth.
 *
 * The base is `startGame()` moved on to the `playing` phase, because a fixture
 * almost always wants a game that is running: leaving it in `ready` would mean
 * every system test in s10 and s11 opened by remembering to skip a countdown,
 * and the one that forgot would assert that nothing moved and pass.
 *
 * Derived from `startGame` rather than written out, so a field added to
 * `GameState` tomorrow is present in every fixture the day it exists. The two
 * assertions are the boundary described on `UnknownRecord`: they are safe
 * precisely because `StatePatch` is `DeepPatch<GameState>`, so every key the
 * loop can meet is a key of the state, carrying a value of the state's type.
 */
export function buildState(patch: StatePatch = {}): GameState {
  const base: GameState = {
    ...startGame(),
    phase: RoundPhase.Playing,
    phaseFramesLeft: PHASE_FRAMES[RoundPhase.Playing],
  };
  return deepMerge(base as unknown as UnknownRecord, patch) as unknown as GameState;
}
