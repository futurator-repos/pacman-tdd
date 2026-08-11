import { describe, expect, it } from 'vitest';

import { Direction } from '../../geometry/direction.ts';
import { centreOf, type Tile } from '../../geometry/tile.ts';
import { GhostId } from '../../ghost/ghost-id.ts';
import { GhostPhase } from '../../ghost/ghost.ts';
import { ARCADE_MAZE } from '../../maze/arcade-maze.ts';
import { createPelletField, eatAt, type PelletField } from '../../maze/pellets.ts';
import { buildState } from '../../testing/state-builder.ts';
import { type GameEvent } from '../game-event.ts';
import { RoundPhase } from '../game-phase.ts';
import { type GameState } from '../game-state.ts';

import { lifeSystem } from './life-system.ts';
import { frameContext } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * This is the system that decides whether the player is still playing.
 *
 * A ghost touching Pac-Man is detected by the collision system, which says so
 * with `pacmanCaught` and changes nothing else — collision is a fact about two
 * tiles, and it runs TWICE in one frame (`SystemId`'s note on the arcade
 * pass-through). Turning that fact into a consequence happens exactly once, in
 * this file: one life spent, the round frozen for the death animation, and, when
 * the last life goes, the game over. Every one of those is irreversible, so a
 * mistake here is not a glitch the player can play around.
 *
 * THE THREE MISTAKES IT IS WRITTEN AGAINST, all of which look fine on screen:
 *
 *   - **Two lives for one ghost.** Both collision passes report the same catch,
 *     and an implementation that reacts per EVENT rather than per FRAME spends
 *     two. From three lives, a player dies twice as fast as the machine says
 *     they should and nothing anywhere logs an error.
 *   - **A respawn that refills the board.** The reset that puts the actors back
 *     on their spawn tiles is one careless call away from also putting back the
 *     244 dots — the round becomes unfinishable, and the global dot counter of
 *     section 12.2 starts against a board that has already been eaten.
 *   - **A game that cannot end.** Spending the last life without leaving
 *     `playing` gives an unloseable machine: the HUD shows zero lives and the
 *     ghosts keep hunting.
 *
 * WHY EVERY TEST BELOW HANDS THE DEATH IN AS AN EVENT. `incoming` is the only
 * channel between systems, and the death is the collision system's news. If this
 * file re-derived it — by comparing tiles itself, or by noticing the phase —
 * there would be two definitions of "caught" in one frame, and the frame would
 * have no single source of truth about the most consequential thing that can
 * happen in it.
 *
 * WHY THE FIXTURE IS SO DELIBERATELY UNTIDY. The world below is in NONE of the
 * states this system is supposed to produce: the actors are out on the board
 * rather than on their spawn tiles, Pinky is out of the house, the fright timer
 * is running, the global dot counter is off and standing at 21, the board is
 * part-eaten, and there are 2 lives so that "1" distinguishes lives-after from
 * lives-before and from the default 3. A fixture already sitting in the answer
 * cannot fail, and a reset that never ran would look exactly like a reset that
 * did.
 */

/** Where Pac-Man is caught: the far-left corridor, nowhere near the `P` tile. */
const PACMAN_TILE: Tile = { col: 1, row: 5 };

/** Blinky, out on the right of the board rather than above the house. */
const BLINKY_TILE: Tile = { col: 26, row: 5 };

/** Pinky, long since out of the house and hunting in the lower maze. */
const PINKY_TILE: Tile = { col: 6, row: 20 };

/**
 * The board with 70 dots gone — the count that spawns the first fruit
 * (docs/ARCADE-REFERENCE.md section 8.1). Eaten with the real `eatAt` rather
 * than hand-written, so it is a board that can actually occur; part-eaten rather
 * than full, so that a respawn which rebuilt the pellet field fails on VALUE as
 * well as on identity.
 */
const PART_EATEN_BOARD: PelletField = ARCADE_MAZE.pelletTiles
  .slice(0, 70)
  .reduce<PelletField>((field, tile) => eatAt(field, tile), createPelletField(ARCADE_MAZE));

/** The catch, as the collision system reports it. */
const CAUGHT_BY_BLINKY: GameEvent = { kind: 'pacmanCaught', ghost: GhostId.Blinky };

/**
 * The frame Pac-Man is caught on, with `lives` still unspent.
 *
 * Level 5 and a score of 4570 are here to be SURVIVORS: a respawn that called
 * `startGame` instead of restarting the round would wipe both, and 0 is not a
 * value a test can mistake for a preserved one.
 */
function sceneOfTheCatch(lives: number): GameState {
  return buildState({
    level: 5,
    score: 4570,
    lives,
    phase: RoundPhase.Playing,
    phaseFramesLeft: 0,
    pellets: PART_EATEN_BOARD,
    pacman: {
      actor: { position: centreOf(PACMAN_TILE), facing: Direction.Right },
      pendingDirection: Direction.Up,
      stopFrames: 2,
    },
    ghosts: {
      [GhostId.Blinky]: {
        actor: { position: centreOf(BLINKY_TILE), facing: Direction.Down },
      },
      [GhostId.Pinky]: {
        actor: { position: centreOf(PINKY_TILE), facing: Direction.Left },
        phase: GhostPhase.Hunting,
        frightenedFramesLeft: 200,
      },
    },
    modes: { waveIndex: 3, waveFrames: 411, frightenedFramesLeft: 200 },
    house: { globalCounter: 21, globalCounterActive: false, framesSinceDot: 137 },
  });
}

describe('lifeSystem', () => {
  /**
   * TYPE: unit.
   * WHY THIS TYPE: the whole question is "was there a `pacmanCaught` in this
   *   list?", and a list is the cheapest thing to hand a function. Driving a
   *   real ghost into Pac-Man through the pipeline would test the collision
   *   system's tile comparison, which is somebody else's file and already green.
   * MEASURES: that a frame full of OTHER news — a dot eaten, a ghost eaten —
   *   costs no life, changes nothing, and says nothing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.6, "Losing a life": a life is
   *   spent when Pac-Man is caught. Section 13.4's collision rule is explicit
   *   that a FRIGHTENED ghost is eaten and only a hunting one kills, so
   *   `ghostEaten` is the near-miss that must not read as a death.
   * CATCHES: `incoming.length > 0` as the trigger, which is the shape this
   *   system is most likely to be written in by someone in a hurry. Every dot
   *   eaten would cost a life: the player would be dead within two seconds of
   *   the first round, and nothing would look broken except the life counter.
   * LOAD-BEARING: no — the stub also does nothing here. A guard, and the only
   *   test that discriminates on `kind` rather than on presence.
   */
  it('spends nothing on a frame whose news is a dot and a ghost eaten', () => {
    const state = sceneOfTheCatch(2);
    const busyFrame: readonly GameEvent[] = [
      { kind: 'pelletEaten', tile: { col: 1, row: 5 }, remaining: 173 },
      { kind: 'ghostEaten', ghost: GhostId.Pinky, points: 400, chain: 2 },
    ];

    const { state: next, events } = lifeSystem.run(state, frameContext(), busyFrame);

    /* Identity, not equality: a system that changes nothing must hand back the
       very object it was given, and `toEqual` would pass against a copy. */
    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: one incoming event in, three fields and one event out.
   * MEASURES: that a reported catch spends exactly one life, freezes the round
   *   in `dying` for its full countdown, and announces the death with the number
   *   of lives that are LEFT.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.6, "Losing a life" — with more
   *   than one life, "one life spent, the round restarts", so 2 becomes **1**.
   *   The freeze is section 7.2, "Round-phase durations": `dying` is **180
   *   frames** (3 s) — "a ~1 s freeze on the moment of capture, then the ~2 s
   *   death spin". The literals 1 and 180 are written here rather than imported
   *   so that a wrong edit to either table fails in this file too; 180 is also
   *   the row NEITHER neighbour has (`ready` and `levelComplete` are both 120),
   *   which is exactly the copy-paste that table is spaced out to catch.
   * CATCHES: the death that costs nothing. The ghost walks over Pac-Man, the
   *   music carries on, the life counter never moves and the machine can never
   *   be lost. And, on the event, `livesLeft: 2` — the count BEFORE the death —
   *   which would draw one life too many in the HUD for the rest of the game.
   * LOAD-BEARING: yes — the stub leaves the phase in `playing` and emits
   *   nothing.
   */
  it('spends one life and freezes the round for the death animation', () => {
    const state = sceneOfTheCatch(2);

    const { state: next, events } = lifeSystem.run(state, frameContext(), [CAUGHT_BY_BLINKY]);

    expect(next.lives).toBe(1);
    expect(next.phase).toBe(RoundPhase.Dying);
    expect(next.phaseFramesLeft).toBe(180);
    /* `toEqual` on the whole array rather than `toContainEqual`: this system
       announces the death and, at zero lives, the end of the game — nothing
       else. The phase system owns timed transitions and emits `phaseChanged`
       itself, so a second event here would send the same fact twice down the
       audio channel and play the death jingle over the READY! tune. */
    expect(events).toEqual([{ kind: 'pacmanDied', livesLeft: 1 }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the claim is about a produced state, and every field of it is
   *   readable in one call. An integration test would have to walk a ghost into
   *   Pac-Man to assert the same nine values.
   * MEASURES: that the round is REBUILT around the surviving game — every actor
   *   back on its arcade spawn tile facing the right way, Pinky back inside the
   *   house, the fright timer and the wave clock wound back, the global dot
   *   counter armed at zero — while the part-eaten board, the score and the
   *   level survive untouched.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7.3, "Where everything stands when
   *   a round starts": Pac-Man on **(13, 23)** facing **left**, Blinky on
   *   **(13, 11)** facing **left**, Pinky on **(13, 14)** facing **down** and
   *   inside the house, every actor on the **centre pixel** of its tile, and the
   *   wave clock at "wave 0, zero frames spent, no fright running". The counter
   *   is section 12.2, "The global counter, after a life is lost": losing a life
   *   switches the machine to the global counter — which starts at **0**, since
   *   its limits are the 7/17/32 in that table. What SURVIVES is the `startRound`
   *   contract in src/core/game/new-game.ts: the score, the lives and the high
   *   score belong to the game, never to the round.
   * CATCHES: three separate ships. (a) The reset omitted, so the player respawns
   *   standing on the ghost that just killed them and loses every remaining life
   *   in three seconds. (b) `startRound` called wholesale, which puts all 244
   *   dots back: the round can never be finished, and the global counter of
   *   12.2 runs against a board that has already been eaten. (c) The counter
   *   switch forgotten, so the next life uses personal counters that are already
   *   satisfied and empties the house the instant the round restarts — the house
   *   system's own tests pass throughout, because they are handed the flag.
   * LOAD-BEARING: yes — the stub leaves every actor exactly where it died.
   */
  it('restarts the round on the same part-eaten board and arms the global dot counter', () => {
    const state = sceneOfTheCatch(2);

    const { state: next } = lifeSystem.run(state, frameContext(), [CAUGHT_BY_BLINKY]);

    expect(next.pacman.actor.position).toEqual(centreOf({ col: 13, row: 23 }));
    expect(next.pacman.actor.facing).toBe(Direction.Left);
    expect(next.ghosts[GhostId.Blinky].actor.position).toEqual(centreOf({ col: 13, row: 11 }));
    expect(next.ghosts[GhostId.Pinky].actor.position).toEqual(centreOf({ col: 13, row: 14 }));
    /* The phase, not just the position: a Pinky put back on her tile while still
       flagged `hunting` would walk straight out through the house wall. */
    expect(next.ghosts[GhostId.Pinky].phase).toBe(GhostPhase.InHouse);
    expect(next.ghosts[GhostId.Pinky].frightenedFramesLeft).toBe(0);
    expect(next.modes).toEqual({ waveIndex: 0, waveFrames: 0, frightenedFramesLeft: 0 });
    expect(next.house).toEqual({ globalCounter: 0, globalCounterActive: true, framesSinceDot: 0 });
    /* Identity on the board: the 70 dots the player ate stay eaten. A rebuilt
       field would be a different object even when it happened to be equal. */
    expect(next.pellets).toBe(state.pellets);
    expect(next.score).toBe(4570);
    expect(next.level).toBe(5);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the last life differs from every other life by one branch,
   *   and the branch is visible in the returned state and the returned events.
   * MEASURES: that the last life ends the game rather than starting another
   *   round — `gameOver`, not `dying` — and that both events go out, the death
   *   first and then the end of the game carrying the final score.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.6: with exactly 1 life, "one
   *   life spent, **game over**", so lives become **0**. The phase is section
   *   7.2, whose `gameOver` row is **0 frames** — "the game is over; nothing
   *   counts down to anything" — and phase-system's `NEXT_PHASE` is what makes
   *   that load-bearing: a `dying` phase always leads back to `ready`, so a game
   *   over routed through `dying` would put a player with no lives back on the
   *   board three seconds later.
   * CATCHES: the unloseable machine — zero lives, and the round restarts anyway.
   *   The score on the event catches the other half: `gameOver` is what the HUD
   *   and the high-score line read, and a 0 there erases a 4570-point run at the
   *   exact moment the player wants to see it.
   * LOAD-BEARING: yes — the stub neither ends the game nor emits anything.
   */
  it('ends the game instead of restarting the round when the last life goes', () => {
    const state = sceneOfTheCatch(1);

    const { state: next, events } = lifeSystem.run(state, frameContext(), [CAUGHT_BY_BLINKY]);

    expect(next.lives).toBe(0);
    expect(next.phase).toBe(RoundPhase.GameOver);
    expect(next.phaseFramesLeft).toBe(0);
    /* Order matters, which is why this is one array and not two assertions: the
       audio director plays the death, then stops the loops on the game over
       (docs/TEST-PLAN.md, audio-io). Reversed, the death cry starts after
       everything has been silenced and is never heard. */
    expect(events).toEqual([
      { kind: 'pacmanDied', livesLeft: 0 },
      { kind: 'gameOver', score: 4570 },
    ]);
    /* The board is left exactly as the player lost it. There is no round to
       restart, and a game-over screen showing every actor neatly back on its
       spawn tile would be a picture of a game that never happened. */
    expect(next.pacman.actor.position).toEqual(centreOf(PACMAN_TILE));
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the situation is a property of one frame's event list, and
   *   the list is the entire input. The pipeline that produces such a list is
   *   pinned in slice s12; recreating it here would test the pipeline.
   * MEASURES: that a frame carrying TWO catches — which is what a real frame
   *   carries, because collision runs once after Pac-Man moves and again after
   *   the ghosts move — costs exactly ONE life and emits exactly ONE
   *   `pacmanDied`.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.6 — one catch, one life; the
   *   zero row of that table exists precisely because of "the bug that calls
   *   `loseLife` twice". `SystemId`'s note is the reason two arrive: the two
   *   collision passes are what reproduce the arcade pass-through, so both
   *   reporting a ghost on Pac-Man's tile is the normal case, not a pathology.
   *   Two different ghosts rather than the same one twice, because a real frame
   *   can have Blinky already on the tile and Pinky arriving on it, and because
   *   a de-duplication written on the GHOST would pass a repeat of one id.
   * CATCHES: `incoming.filter(...).forEach(...)` — the natural way to write
   *   this, and wrong. Two lives go for one mistake, three lives last a minute
   *   and a half, and every single-event test in this file stays green.
   * LOAD-BEARING: yes — the stub spends no lives at all.
   */
  it('spends one life, not two, when both collision passes report a catch', () => {
    const state = sceneOfTheCatch(2);
    const bothPasses: readonly GameEvent[] = [
      CAUGHT_BY_BLINKY,
      { kind: 'pacmanCaught', ghost: GhostId.Pinky },
    ];

    const { state: next, events } = lifeSystem.run(state, frameContext(), bothPasses);

    expect(next.lives).toBe(1);
    expect(next.phase).toBe(RoundPhase.Dying);
    expect(events).toEqual([{ kind: 'pacmanDied', livesLeft: 1 }]);
  });
});
