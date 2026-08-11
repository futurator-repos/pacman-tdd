import { Direction } from '../geometry/direction.ts';
import { centreOf } from '../geometry/tile.ts';
import { GhostId } from '../ghost/ghost-id.ts';
import { GhostPhase, type Ghost } from '../ghost/ghost.ts';
import { mazeForLevel } from '../maze/arcade-maze.ts';
import { type Maze } from '../maze/maze.ts';
import { createPelletField } from '../maze/pellets.ts';
import { spawnPacman } from '../pacman/pacman.ts';
import { NO_FRUIT } from '../rules/fruit.ts';

import { PHASE_FRAMES, RoundPhase } from './game-phase.ts';
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
 * Three lives is the cabinet's factory DIP setting rather than a property of
 * the ROM, so it is fixed here as a default a caller may override — which is
 * also what lets a replay fixture start on level 5 with one life.
 */
const NEW_GAME_DEFAULTS: NewGameOptions = {
  startLevel: 1,
  lives: 3,
  highScore: 0,
};

/**
 * Which way each ghost faces at the top of a round, and whether it is on the
 * board or waiting inside the house.
 *
 * A table rather than four literals buried in a builder, because these are the
 * weakest claims on the reference page: docs/ARCADE-REFERENCE.md section 7.3
 * tags every facing `[repo convention]`, read off the original's round-start
 * screen. A table is the shape a correction from a ROM disassembly can be
 * applied to without touching a line of code.
 *
 * Blinky alone starts `Hunting`. Section 12 states it plainly — "Blinky starts
 * on the board, the other three start inside the house" — and `Hunting` is the
 * only on-board phase of the five, so the mapping is a reading rather than a
 * choice.
 */
const ROUND_OPENING: Readonly<
  Record<GhostId, { readonly facing: Direction; readonly phase: GhostPhase }>
> = {
  [GhostId.Blinky]: { facing: Direction.Left, phase: GhostPhase.Hunting },
  [GhostId.Pinky]: { facing: Direction.Down, phase: GhostPhase.InHouse },
  [GhostId.Inky]: { facing: Direction.Up, phase: GhostPhase.InHouse },
  [GhostId.Clyde]: { facing: Direction.Up, phase: GhostPhase.InHouse },
};

/**
 * One ghost, on the CENTRE PIXEL of its spawn tile.
 *
 * The centre matters more than it looks: every turn decision in
 * `move-actor.ts` is taken on a centre pixel, so a ghost spawned on the tile's
 * corner would be half a tile out of phase forever and its first turn of every
 * round would behave unlike every later one.
 *
 * `dotCounterActive` follows the phase rather than being a fifth column of the
 * table above, because it is the same fact said twice: a personal dot counter
 * is what gets a WAITING ghost out of the house (docs/ARCADE-REFERENCE.md
 * section 12.1), so a ghost already on the board has nothing to count.
 */
function spawnGhost(maze: Maze, id: GhostId): Ghost {
  const opening = ROUND_OPENING[id];
  return {
    id,
    actor: {
      position: centreOf(maze.ghostSpawns[id]),
      facing: opening.facing,
      queued: null,
      carrySubPixels: 0,
    },
    phase: opening.phase,
    frightenedFramesLeft: 0,
    dotCounter: 0,
    dotCounterActive: opening.phase === GhostPhase.InHouse,
    elroyStage: 0,
    reverseQueued: false,
  };
}

/** Exactly the fields a ROUND owns — the ones `startRound` rebuilds. */
type RoundOpening = Pick<
  GameState,
  'phase' | 'phaseFramesLeft' | 'pacman' | 'ghosts' | 'pellets' | 'fruit' | 'modes' | 'house'
>;

/**
 * Everything a round starts with, for both callers.
 *
 * Written as a `Pick` of `GameState` and spread by both functions below, so
 * "which fields belong to the round and which to the game" is stated ONCE, in
 * a type the compiler checks, rather than being a pair of object literals that
 * have to be kept in step by whoever edits them next.
 *
 * The board comes from `mazeForLevel(level)` — the game's single maze lookup,
 * shared with `buildScene` — so the dots the rules place and the board the
 * player sees can never come from different sources.
 */
function openRound(level: number): RoundOpening {
  const maze = mazeForLevel(level);
  return {
    phase: RoundPhase.Ready,
    phaseFramesLeft: PHASE_FRAMES[RoundPhase.Ready],
    pacman: spawnPacman(maze),
    ghosts: {
      [GhostId.Blinky]: spawnGhost(maze, GhostId.Blinky),
      [GhostId.Pinky]: spawnGhost(maze, GhostId.Pinky),
      [GhostId.Inky]: spawnGhost(maze, GhostId.Inky),
      [GhostId.Clyde]: spawnGhost(maze, GhostId.Clyde),
    },
    pellets: createPelletField(maze),
    fruit: NO_FRUIT,
    modes: { waveIndex: 0, waveFrames: 0, frightenedFramesLeft: 0 },
    house: { globalCounter: 0, globalCounterActive: false, framesSinceDot: 0 },
  };
}

/**
 * A brand-new game: level 1, three lives, a full board, every actor on its
 * arcade spawn tile, and the "READY!" countdown running.
 *
 * docs/ARCADE-REFERENCE.md section 7.
 */
export function startGame(options: NewGameOptions = NEW_GAME_DEFAULTS): GameState {
  return {
    level: options.startLevel,
    frame: 0,
    ...openRound(options.startLevel),
    score: 0,
    highScore: options.highScore,
    extraLifeAwarded: false,
    lives: options.lives,
    pendingMs: 0,
  };
}

/**
 * The next round of a game already in progress.
 *
 * Used both by the level transition and, in slice s11, by the respawn after a
 * death — which is why the score, the lives and the high score are arguments of
 * the existing state rather than of the options.
 *
 * The spread is doing the load-bearing work, and it is worth reading in that
 * light: everything the GAME owns — the score, the lives, the high score, the
 * extra-life latch, the running frame counter, the banked milliseconds —
 * survives simply by not being mentioned, and everything the ROUND owns is
 * replaced wholesale by `openRound`. A field added to `GameState` therefore
 * defaults to "belongs to the game", which is the safe direction: forgetting to
 * reset something costs a stale value for one round, while accidentally
 * resetting the score is the most enraging bug this game could ship.
 */
export function startRound(state: GameState, level: number): GameState {
  return { ...state, level, ...openRound(level) };
}
