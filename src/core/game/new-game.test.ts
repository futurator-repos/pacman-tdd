import { describe, expect, it } from 'vitest';

import { Direction } from '../geometry/direction.ts';
import { centreOf } from '../geometry/tile.ts';
import { GhostId } from '../ghost/ghost-id.ts';
import { GhostPhase } from '../ghost/ghost.ts';
import { ARCADE_MAZE } from '../maze/arcade-maze.ts';

import { PHASE_FRAMES, RoundPhase } from './game-phase.ts';
import { type GameState } from './game-state.ts';
import { startGame, startRound } from './new-game.ts';

/**
 * The two ways a world comes into existence.
 *
 * Nothing else in this codebase builds a `GameState` from nothing — not a
 * system, not a test, not the shell. That is why these tests are worth their
 * length: every later assertion in the project is made about a state that came
 * out of one of these two functions, so a wrong value here is a wrong value
 * everywhere, and it would be invisible because everything would agree with it.
 *
 * Where the numbers come from. Spawn tiles are read from `ARCADE_MAZE`, which
 * slice s02 already pinned against the board — asserting them here as literals
 * would be transcribing the same fact twice and the two copies would eventually
 * disagree. Frame counts and the starting-lives figure are literals, cited to
 * docs/ARCADE-REFERENCE.md section 7, exactly as the house style requires: a
 * duration computed by the same arithmetic the implementation uses is no longer
 * an independent oracle.
 */

/** The complete field list of a `GameState`, alphabetised. Used by the serialisation test. */
const GAME_STATE_KEYS: readonly string[] = [
  'extraLifeAwarded',
  'frame',
  'fruit',
  'ghosts',
  'highScore',
  'house',
  'level',
  'lives',
  'modes',
  'pacman',
  'pellets',
  'pendingMs',
  'phase',
  'phaseFramesLeft',
  'score',
];

/** A tile's flat index, the form the pellet field stores. */
function flatIndex(tile: { readonly col: number; readonly row: number }): number {
  return tile.row * ARCADE_MAZE.columns + tile.col;
}

/**
 * Ascending copy of a list of indices.
 *
 * The tests below compare the starting board against the maze's dots by VALUE
 * and not by ORDER: which end of the board the parser happened to walk first is
 * not a rule anybody should be able to break by mistake, and pinning it would
 * make a harmless refactor a red test. Sorting states that decision out loud
 * rather than hiding it in a `toEqual` that happens to pass.
 */
function ascending(indices: readonly number[]): readonly number[] {
  return [...indices].sort((a, b) => a - b);
}

describe('phase durations', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: A five-row lookup table, compared whole in one assertion.
   *   There is nothing to integrate and nothing to generate: the domain has
   *   five elements and all five are asserted, which is the cheapest complete
   *   test that exists.
   * MEASURES: The frame duration attached to every RoundPhase, including the
   *   two that deliberately have none.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7.2: ready 120 frames (2 s), dying
   *   180 (3 s), levelComplete 120 (2 s), and playing and gameOver 0, where 0
   *   means "this phase is ended by an event, not by a countdown".
   * CATCHES: The classic copy-paste in a table like this — a row reading its
   *   neighbour's value. Compared whole rather than row by row precisely so
   *   that a swap of two rows fails; three separate `toBe`s on three equal
   *   numbers could not tell a swap from a correct table, which is why the
   *   reference deliberately gives the three timed phases different durations.
   * LOAD-BEARING: yes — the stub table is all zeros.
   */
  it('gives ready 120 frames, dying 180 and levelComplete 120, and leaves playing and gameOver untimed', () => {
    expect(PHASE_FRAMES).toEqual({
      [RoundPhase.Ready]: 120, // 2 s
      [RoundPhase.Playing]: 0, // no timer: ends on an event
      [RoundPhase.Dying]: 180, // 3 s
      [RoundPhase.LevelComplete]: 120, // 2 s
      [RoundPhase.GameOver]: 0, // no timer: nothing ends it
    });
  });
});

describe('startGame', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One call, no time, no maze traversal — the scalars of a
   *   fresh game are a pure fact about one function. Reaching them through a
   *   tick would prove the same thing more slowly and would blame the pipeline
   *   when the constructor was wrong.
   * MEASURES: Every scalar field of a brand-new game at once: which level, how
   *   many lives, the score, the frame counter, the banked milliseconds, the
   *   opening phase and its countdown.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7.1 (three lives, the cabinet's
   *   factory setting) and 7.2 (the ready phase lasts 120 frames). Score, high
   *   score, frame, pendingMs and extraLifeAwarded are zero because nothing has
   *   happened yet — the definition of "new game".
   * CATCHES: A game that starts on level 0 (every level lookup then reads the
   *   wrong difficulty row), with two lives, or already in the playing phase —
   *   the last of which means the ghosts start moving while the player is still
   *   reading "READY!". Asserted as ONE object so the failure names every wrong
   *   field at once instead of stopping at the first.
   * LOAD-BEARING: yes — the stub returns level 0, no lives and a zero countdown.
   */
  it('starts on level 1 with three lives, no score and the ready countdown running', () => {
    const state = startGame();

    expect({
      level: state.level,
      lives: state.lives,
      score: state.score,
      highScore: state.highScore,
      frame: state.frame,
      pendingMs: state.pendingMs,
      phase: state.phase,
      phaseFramesLeft: state.phaseFramesLeft,
      extraLifeAwarded: state.extraLifeAwarded,
    }).toEqual({
      level: 1,
      lives: 3,
      score: 0,
      highScore: 0,
      frame: 0,
      pendingMs: 0,
      phase: RoundPhase.Ready,
      phaseFramesLeft: 120, // 2 s
      extraLifeAwarded: false,
    });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Five actors, five assertions, one call. A property test has
   *   nothing to generate here — there is exactly one starting position per
   *   actor — and an integration test would reach the same five values after
   *   dragging in the mover.
   * MEASURES: That every actor stands on the CENTRE PIXEL of its own spawn
   *   tile, facing the documented direction, with nothing queued and a zero
   *   sub-pixel carry — and that Blinky alone starts OUTSIDE the house.
   * ORACLE: Spawn tiles come from ARCADE_MAZE, pinned to the board in
   *   src/core/maze/arcade-maze.test.ts — read rather than re-transcribed, so
   *   the two can never disagree. The centre-pixel rule and the five facings are
   *   docs/ARCADE-REFERENCE.md section 7.3, where the facings are tagged
   *   [repo convention] and the reason is given. The opening phases are section
   *   12, tagged [Dossier]: "Blinky starts on the board. The other three start
   *   inside the house." `Hunting` is the only on-board phase of the five, so
   *   the mapping is a reading of the reference rather than a choice made here.
   * CATCHES: Actors spawned on the tile's top-left corner instead of its centre.
   *   `isAtTileCentre` would then be false forever, no actor would ever be
   *   allowed to turn, and the game would look correct for exactly one corridor.
   *   Also catches a ghost given Pac-Man's spawn, which is a game that begins
   *   with an instant death. And a Blinky who starts INSIDE the house: he would
   *   then wait on a release rule that section 12.1 gives him a limit of 0 for,
   *   so the bug would only ever show as one wasted frame — until slice s11's
   *   Cruise Elroy, which is Blinky-only and assumes he is on the board.
   * LOAD-BEARING: yes — the stub puts all five at the pixel origin. Note that
   *   the three `InHouse` assertions are NOT load-bearing on their own: the
   *   inert ghost is already `InHouse`, so they are guards in the sense of
   *   docs/TDD-FINDINGS.md category (b). Blinky's is the one that fails, and
   *   the three are kept beside it because "every ghost starts in the house" is
   *   the exact wrong implementation Blinky's assertion is aimed at.
   */
  it('places every actor on the centre of its arcade spawn tile, facing the documented way', () => {
    const state = startGame();

    expect(state.pacman.actor).toEqual({
      position: centreOf(ARCADE_MAZE.pacmanSpawn),
      facing: Direction.Left,
      queued: null,
      carrySubPixels: 0,
    });
    expect(state.ghosts[GhostId.Blinky].actor).toEqual({
      position: centreOf(ARCADE_MAZE.ghostSpawns[GhostId.Blinky]),
      facing: Direction.Left,
      queued: null,
      carrySubPixels: 0,
    });
    expect(state.ghosts[GhostId.Pinky].actor).toEqual({
      position: centreOf(ARCADE_MAZE.ghostSpawns[GhostId.Pinky]),
      facing: Direction.Down,
      queued: null,
      carrySubPixels: 0,
    });
    expect(state.ghosts[GhostId.Inky].actor).toEqual({
      position: centreOf(ARCADE_MAZE.ghostSpawns[GhostId.Inky]),
      facing: Direction.Up,
      queued: null,
      carrySubPixels: 0,
    });
    expect(state.ghosts[GhostId.Clyde].actor).toEqual({
      position: centreOf(ARCADE_MAZE.ghostSpawns[GhostId.Clyde]),
      facing: Direction.Up,
      queued: null,
      carrySubPixels: 0,
    });

    /* Blinky is on the board; the other three are in the house. Section 12. */
    expect(state.ghosts[GhostId.Blinky].phase).toBe(GhostPhase.Hunting);
    expect(state.ghosts[GhostId.Pinky].phase).toBe(GhostPhase.InHouse);
    expect(state.ghosts[GhostId.Inky].phase).toBe(GhostPhase.InHouse);
    expect(state.ghosts[GhostId.Clyde].phase).toBe(GhostPhase.InHouse);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: One call with an argument, compared against that argument.
   *   Nothing to integrate — the claim is that a parameter reaches three fields.
   * MEASURES: That `NewGameOptions` is actually READ. A replay fixture that
   *   starts on level 5 with one life, and a session that carries the previous
   *   game's high score in, both depend on it.
   * ORACLE: The documented contract of `NewGameOptions` in new-game.ts —
   *   "startLevel: almost always 1. Not 1 when a replay fixture starts on a
   *   later level"; "highScore: carried in from the previous game in the same
   *   session" — and docs/ARCHITECTURE.md, "GameInput and Replay", which makes
   *   `options` one of the three fields a Replay consists of.
   * CATCHES: A `startGame` that hardcodes level 1 and three lives and ignores
   *   its argument. Every other test in this file calls `startGame()` with no
   *   arguments, so that implementation is green everywhere else — and the
   *   symptom arrives much later as a replay fixture that silently plays back
   *   the wrong level with the wrong difficulty row.
   *   Deliberately asserts ONLY the three fields the options name: what a
   *   `startLevel` of 5 implies for the board or the LevelSpec is slice s10's
   *   rule, not this function's contract.
   * LOAD-BEARING: yes — the stub returns level 0, no lives and no high score.
   */
  it('honours the options it is given: the start level, the lives and the carried-in high score', () => {
    const state = startGame({ startLevel: 5, lives: 1, highScore: 19000 });

    expect({ level: state.level, lives: state.lives, highScore: state.highScore }).toEqual({
      level: 5,
      lives: 1,
      highScore: 19000,
    });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The opening board is a value, and one call produces it. The
   *   244 dots are counted, not walked, so there is no traversal to integrate.
   * MEASURES: That a new game gets the WHOLE board — 240 dots and 4 energizers,
   *   nothing eaten — and that the three clocks (wave, fruit, ghost house) all
   *   read zero.
   * ORACLE: 240 plain pellets and 4 energizers are the classic board's counts,
   *   pinned by slice s02 in classic-layout.test.ts. Which tiles they sit on is
   *   read from ARCADE_MAZE rather than re-listed. A round opens with no fruit
   *   on the board and none of the level's two used up (docs/ARCADE-REFERENCE.md
   *   section 7.3), and the zeroed wave clock follows from section 4: a round
   *   opens at the start of wave 0.
   * CATCHES: A board that starts with the energizers already counted as eaten
   *   (the level ends four dots early and the level-clear test still passes), or
   *   a wave clock that starts mid-schedule, which would put the ghosts in chase
   *   from the first frame and make the opening scatter — the thing that gives a
   *   player a chance — silently vanish.
   * LOAD-BEARING: yes — the stub's board is empty.
   */
  it('fills the board with the maze full of dots: 240 plain, 4 energizers, none eaten', () => {
    const state = startGame();

    expect(state.pellets.pellets.size).toBe(240);
    expect(state.pellets.powerPellets.size).toBe(4);
    expect(state.pellets.eaten).toBe(0);
    /* The field carries the board's width so that `pelletAt` can decode a flat
       index without being handed the maze. A zero here makes every tile lookup
       read the wrong row. */
    expect(state.pellets.columns).toBe(28);

    /* The dots ARE the maze's dots. Compared by value, not by order — see
       `ascending` above for why the order is deliberately not pinned. */
    expect(ascending([...state.pellets.pellets])).toEqual(
      ascending(ARCADE_MAZE.pelletTiles.map(flatIndex)),
    );
    expect(ascending([...state.pellets.powerPellets])).toEqual(
      ascending(ARCADE_MAZE.powerPelletTiles.map(flatIndex)),
    );

    expect(state.modes).toEqual({ waveIndex: 0, waveFrames: 0, frightenedFramesLeft: 0 });
    expect(state.house).toEqual({
      globalCounterActive: false,
      globalCounter: 0,
      framesSinceDot: 0,
    });
    /* Written as a literal rather than as slice s08's `NO_FRUIT` constant: an
       expectation that imports the very value the implementation returns would
       keep passing however wrong that value became. */
    expect(state.fruit).toEqual({ onBoard: null, framesLeft: 0, spawned: 0 });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A structural invariant of one value. It needs no gameplay,
   *   and running it through a whole game would only make the failure harder to
   *   read while checking exactly the same thing.
   * MEASURES: That a GameState is DATA: it survives structuredClone with every
   *   field intact, and it holds exactly the fifteen documented fields and no
   *   others.
   * ORACLE: The stated design invariant, docs/ARCHITECTURE.md, "GameState": no
   *   maze, no functions, no class instances, no cycles — which is what makes a
   *   failing diff readable. The field list is the interface in game-state.ts,
   *   transcribed here so that ADDING a field is a deliberate act with a failing
   *   test rather than a drive-by.
   *
   *   A CONTRADICTION IN THE SPEC, RESOLVED HERE — worth reading, because
   *   resolving one is a normal part of the job and hiding one is not.
   *   docs/ARCHITECTURE.md says two things that cannot both hold: PelletField is
   *   "two ReadonlySets of tile indices", and a GameState "JSON round-trips".
   *   `JSON.stringify(new Set([1]))` is `{}`, so a JSON round-trip of any state
   *   would silently return an empty board. The sets win, for two reasons that
   *   are about the design rather than about convenience:
   *     - the membership test they exist for runs 244 times a level, and a
   *       `Set<Tile>` was rejected upstream for comparing by reference;
   *     - nothing in this design ever serialises a state. A `Replay` is
   *       `(seed, options, inputs)` — a fact chosen precisely so that a bug
   *       report is small — and `structuredClone` handles Sets exactly.
   *   So this test asserts the invariant in the form that is TRUE, and says so
   *   rather than quietly dropping the half that is not.
   * CATCHES: (1) A function, a class instance or a cycle finding its way into
   *   the state: structuredClone throws on the first two and hangs on nothing —
   *   it simply cannot copy them — so this is the assertion that keeps a state a
   *   value. (2) Someone caching `maze` on the state "for convenience": every
   *   failed assertion anywhere in the project would then print 868 tiles, and
   *   the key list is what stops it.
   * LOAD-BEARING: no — a GUARD, and predicted to PASS against the stub. The
   *   inert state is already plain data with all fifteen keys, so this asserts a
   *   property true of every correct implementation (docs/TDD-FINDINGS.md
   *   category (c), "genuinely true of all implementations"). Kept anyway: it is
   *   the only thing standing between a future `class Ghost` and a state that
   *   can no longer be copied, compared or printed.
   */
  it('is plain data: it survives a structured clone unchanged, and holds no maze', () => {
    const state = startGame();

    expect(structuredClone(state)).toStrictEqual(state);
    expect(Object.keys(state).sort()).toEqual(GAME_STATE_KEYS);
  });
});

describe('startRound', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One call on a hand-modified legal state. The behaviour is a
   *   partition — these fields survive, those are rebuilt — and a single unit
   *   can show both halves side by side, which is the only way the distinction
   *   is visible at all.
   * MEASURES: That a level transition keeps the score, the lives, the high
   *   score, the extra-life latch and the running frame counter, and rebuilds
   *   everything that belongs to a ROUND: the level number, the board, the
   *   actors, the ghost-house bookkeeping, the wave clock and the ready
   *   countdown.
   *
   *   THE FIXTURE IS DELIBERATELY OFF-SPAWN, and that is the point of half of
   *   it. A `midGame` built by spreading `startGame()` and changing only the
   *   scalars would leave every actor already standing on its spawn tile, so
   *   `next.pacman.actor.position === centreOf(pacmanSpawn)` would pass against
   *   a `startRound` that never touched the actors at all — the assertion would
   *   look like it pinned the reset while pinning nothing. So Pac-Man is moved,
   *   turned to face right, and Clyde is left mid-round as a pair of eyes
   *   heading home. Now "the actors are rebuilt" is a claim the fixture can
   *   falsify. The same reasoning fixes `extraLifeAwarded: true`: `false` is
   *   both the preserved value and the reset value, so the field is invisible
   *   to this test unless the fixture sets it.
   * ORACLE: docs/ARCHITECTURE.md, slice s09: "startRound resets the actors, the
   *   ghost house counters and the mode schedule, but preserves score, lives and
   *   high score — the distinction a level transition depends on." The frame
   *   counter is preserved because game-state.ts defines it as "frames since the
   *   game began", and the renderer derives every animation from it: resetting
   *   it would make every sprite on screen jump on a level change.
   * CATCHES: The obvious direction — clearing level 1 zeroes the player's score,
   *   which is the single most enraging bug this game could ship. And the
   *   opposite — a new round that inherits the previous round's empty board, so
   *   level 2 is complete before it starts and the game runs away through the
   *   levels at sixty frames a second. Also a `startRound` that clears
   *   `extraLifeAwarded`, which hands the player a fresh 10000-point bonus on
   *   every level and is worth infinite lives by level ten (the latch is
   *   "awarded once per GAME", game-state.ts), and one that leaves an eaten
   *   ghost as a pair of eyes for the whole of the next round.
   * LOAD-BEARING: yes — the stub returns the same inert state whatever it is
   *   given, so both halves of the partition fail.
   */
  it('starts the next level fresh but carries the score, the lives and the high score across', () => {
    /* A game in progress: most of the way through level 1, two lives left, the
       extra life already collected, a board that has just been cleared, a wave
       clock deep into the schedule, Pac-Man somewhere in the middle of the maze
       facing right and Clyde on his way home as eyes. Built by mutating a REAL
       started game rather than by hand, so the only fields that differ from a
       legal state are the ones named here. The score is above 10000 because
       `extraLifeAwarded` could not otherwise be true. */
    const started = startGame();
    const midGame: GameState = {
      ...started,
      score: 14260,
      lives: 2,
      highScore: 19000,
      frame: 5000,
      extraLifeAwarded: true,
      phase: RoundPhase.LevelComplete,
      phaseFramesLeft: 1,
      pacman: {
        ...started.pacman,
        actor: {
          ...started.pacman.actor,
          position: { x: 100, y: 164 },
          facing: Direction.Right,
        },
      },
      ghosts: {
        ...started.ghosts,
        [GhostId.Clyde]: {
          ...started.ghosts[GhostId.Clyde],
          actor: { ...started.ghosts[GhostId.Clyde].actor, position: { x: 12, y: 20 } },
          phase: GhostPhase.Eyes,
        },
      },
      pellets: {
        columns: 28,
        pellets: new Set<number>(),
        powerPellets: new Set<number>(),
        eaten: 244,
      },
      modes: { waveIndex: 5, waveFrames: 300, frightenedFramesLeft: 120 },
      house: { globalCounterActive: true, globalCounter: 17, framesSinceDot: 200 },
    };

    const next = startRound(midGame, 2);

    /* Kept: these belong to the GAME. */
    expect(next.score).toBe(14260);
    expect(next.lives).toBe(2);
    expect(next.highScore).toBe(19000);
    expect(next.frame).toBe(5000);
    expect(next.extraLifeAwarded).toBe(true);

    /* Rebuilt: these belong to the ROUND. */
    expect(next.level).toBe(2);
    expect(next.phase).toBe(RoundPhase.Ready);
    expect(next.phaseFramesLeft).toBe(120); // 2 s
    expect(next.pellets.pellets.size).toBe(240);
    expect(next.pellets.powerPellets.size).toBe(4);
    expect(next.pellets.eaten).toBe(0);
    expect(next.pacman.actor.position).toEqual(centreOf(ARCADE_MAZE.pacmanSpawn));
    expect(next.pacman.actor.facing).toBe(Direction.Left); // section 7.3
    expect(next.ghosts[GhostId.Clyde].actor.position).toEqual(
      centreOf(ARCADE_MAZE.ghostSpawns[GhostId.Clyde]),
    );
    expect(next.ghosts[GhostId.Clyde].phase).toBe(GhostPhase.InHouse); // section 12
    expect(next.modes).toEqual({ waveIndex: 0, waveFrames: 0, frightenedFramesLeft: 0 });
    expect(next.house).toEqual({
      globalCounterActive: false,
      globalCounter: 0,
      framesSinceDot: 0,
    });
  });
});
