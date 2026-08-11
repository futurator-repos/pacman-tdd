import { Direction } from '../geometry/direction.ts';
import { GhostId } from '../ghost/ghost-id.ts';
import { GhostPhase, type Ghost } from '../ghost/ghost.ts';

import { RoundPhase } from './game-phase.ts';
import { type GameState } from './game-state.ts';

/**
 * The two ways a `GameState` comes into existence.
 *
 * There are exactly two, and that is the design: no test, no system and no
 * shell hand-builds a world. `startGame` makes a new game; `startRound` makes
 * the next round of an existing one. Everything else is a pure transformation
 * of a state that one of these produced, which is what makes "is this state
 * legal?" a question with one place to look.
 *
 * The difference between them is the interesting part, and it is exactly the
 * distinction a level transition depends on:
 *
 *   `startGame`  — everything from nothing. Score 0, lives 3, board full.
 *   `startRound` — the actors, the house and the wave clock go back to their
 *                  opening positions; the SCORE, the LIVES and the HIGH SCORE
 *                  survive, because they belong to the game, not to the round.
 *
 * Get that wrong in the obvious direction and clearing level 1 resets the
 * player's score to zero. Get it wrong in the other and a fresh game starts
 * with the previous player's ghosts halfway out of the house.
 */

/**
 * What a new game needs to know. Small on purpose: it is one third of a
 * `Replay` (docs/ARCHITECTURE.md, "GameInput and Replay"), so every field here
 * has to be worth storing in a bug report.
 */
export interface NewGameOptions {
  /** Almost always 1. Not 1 when a replay fixture starts on a later level. */
  readonly startLevel: number;
  readonly lives: number;
  /** Carried in from the previous game in the same session; there is no storage. */
  readonly highScore: number;
}

/**
 * The factory settings. docs/ARCADE-REFERENCE.md section 7.1.
 *
 * RED PHASE: inert zeros. GREEN fills in level 1, three lives, no high score.
 */
const NEW_GAME_DEFAULTS: NewGameOptions = {
  startLevel: 0,
  lives: 0,
  highScore: 0,
};

/**
 * RED PHASE: one inert `GameState`, returned by both functions below.
 *
 * It is a legally-typed value with nothing true in it — every actor at the
 * pixel origin, an empty board, no lives — so each assertion in
 * `new-game.test.ts` fails with a readable expected-vs-received diff instead of
 * with an import error, and none of them can pass by accident. GREEN deletes
 * this constant.
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
 * A brand-new game: level 1, three lives, a full board, every actor on its
 * arcade spawn tile, and the "READY!" countdown running.
 *
 * docs/ARCADE-REFERENCE.md section 7.
 */
export function startGame(_options: NewGameOptions = NEW_GAME_DEFAULTS): GameState {
  return INERT_STATE;
}

/**
 * The next round of a game already in progress.
 *
 * Used both by the level transition and, in slice s11, by the respawn after a
 * death — which is why the score, the lives and the high score are arguments of
 * the existing state rather than of the options.
 */
export function startRound(_state: GameState, _level: number): GameState {
  return INERT_STATE;
}
