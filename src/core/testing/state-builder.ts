import { RoundPhase } from '../game/game-phase.ts';
import { type GameState } from '../game/game-state.ts';
import { Direction } from '../geometry/direction.ts';
import { GhostId } from '../ghost/ghost-id.ts';
import { GhostPhase, type Ghost } from '../ghost/ghost.ts';

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
 * RED PHASE: one inert `GameState`, returned whatever the patch says.
 *
 * Deliberately NOT the same value `startGame`'s stub returns, and deliberately
 * ignoring its argument: that is what makes `state-builder.test.ts` fail on its
 * assertions — "the builder's base is a started game" and "a patch is applied"
 * are both genuinely unimplemented, and the red says so. GREEN deletes this.
 */
const INERT_GHOST = {
  actor: {
    position: { x: 0, y: 0 },
    facing: Direction.Up,
    queued: null,
    carrySubPixels: 0,
  },
  phase: GhostPhase.InHouse,
  frightenedFramesLeft: 0,
  dotCounter: 0,
  dotCounterActive: false,
  elroyStage: 0,
  reverseQueued: false,
} as const;

const INERT_STATE: GameState = {
  level: 0,
  frame: 0,
  phase: RoundPhase.Ready,
  phaseFramesLeft: 0,
  pacman: {
    actor: {
      position: { x: 0, y: 0 },
      facing: Direction.Up,
      queued: null,
      carrySubPixels: 0,
    },
    pendingDirection: null,
    stopFrames: 0,
    animationFrame: 0,
  },
  ghosts: {
    [GhostId.Blinky]: { ...INERT_GHOST, id: GhostId.Blinky } satisfies Ghost,
    [GhostId.Pinky]: { ...INERT_GHOST, id: GhostId.Pinky } satisfies Ghost,
    [GhostId.Inky]: { ...INERT_GHOST, id: GhostId.Inky } satisfies Ghost,
    [GhostId.Clyde]: { ...INERT_GHOST, id: GhostId.Clyde } satisfies Ghost,
  },
  pellets: {
    columns: 0,
    pellets: new Set<number>(),
    powerPellets: new Set<number>(),
    eaten: 0,
  },
  fruit: { onBoard: null, framesLeft: 0, spawned: 0 },
  modes: { waveIndex: 0, waveFrames: 0, frightenedFramesLeft: 0 },
  house: { globalCounterActive: false, globalCounter: 0, framesSinceDot: 0 },
  score: 0,
  highScore: 0,
  extraLifeAwarded: false,
  lives: 0,
  pendingMs: 0,
};

/**
 * A legal `GameState`, with the fields in `patch` overridden at any depth.
 *
 * The base is `startGame()` moved on to the `playing` phase, because a fixture
 * almost always wants a game that is running: leaving it in `ready` would mean
 * every system test in s10 and s11 opened by remembering to skip a countdown,
 * and the one that forgot would assert that nothing moved and pass.
 */
export function buildState(_patch: StatePatch = {}): GameState {
  return INERT_STATE;
}
