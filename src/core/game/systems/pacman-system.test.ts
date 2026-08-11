import { describe, expect, it } from 'vitest';

import { Direction } from '../../geometry/direction.ts';
import { levelSpec } from '../../rules/level-table.ts';
import { buildState } from '../../testing/state-builder.ts';
import { RoundPhase } from '../game-phase.ts';

import { pacmanSystem } from './pacman-system.ts';
import { frameContext } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The pacman system is the frame in which the player's intention becomes a
 * position. It owns exactly two decisions and nothing else: **may Pac-Man move
 * at all this frame**, and **how far**. Everything about HOW he moves — the
 * sub-pixel carry, the wall stop, the tunnel wrap, cornering — belongs to
 * `move-actor.ts` and `pacman-turn.ts`, which are already green. This system is
 * a thin adapter, and these tests are written to fail if the wiring is wrong,
 * not to re-prove the engine underneath.
 *
 * The decision worth the most attention is the eating freeze. Pac-Man runs at
 * 80% against the ghosts' 75% at level 1 (docs/ARCADE-REFERENCE.md section 3),
 * so if the freeze is skipped he is permanently faster than everything chasing
 * him and a competent player simply runs laps forever. The Dossier says so in
 * its own words (section 8.2): the one lost frame is _"just enough for a
 * following ghost to overtake him."_ Three of the tests below exist to make an
 * implementation that moves during the freeze fail.
 *
 * UNITS AND THE ORACLE FOR EVERY NUMBER IN THIS FILE.
 *   - The board is 8x8 pixel tiles, so tile (col, row) has its CENTRE pixel at
 *     (col*8 + 4, row*8 + 4) — docs/ARCADE-REFERENCE.md section 2 and
 *     `move-actor.test.ts`, which uses the same arithmetic. Every fixture
 *     position and every expected position below is that sum written out as a
 *     literal, so a reader can check it by eye.
 *   - 100% speed is 1.25 pixels per frame = 320 sub-pixels
 *     (docs/ARCADE-REFERENCE.md section 2, "Speed: what 80% means"), a pixel is
 *     256 sub-pixels, and a frame emits floor((carry + step) / 256) whole
 *     pixels and banks the remainder. Section 3's table gives Pac-Man 80% at
 *     level 1 and 100% at level 5, so:
 *
 *       level 1: round(0.8  * 320) = 256 sub-pixels -> 1 pixel, carry 0
 *       level 5: round(1.0  * 320) = 320 sub-pixels -> 1 pixel, carry 64
 *
 *     THE CARRY IS THE ASSERTION THAT DOES THE WORK, because at level 1 three
 *     other rows of section 3 also move Pac-Man about a pixel a frame and only
 *     the remainder tells them apart: the dot speed 0.71 -> 227 (0 pixels), the
 *     frightened speed 0.9 -> 288 (1 pixel, carry 32) and the ghosts' 0.75 ->
 *     240 (0 pixels). A test that checked the position alone would pass while
 *     reading the wrong row of the table.
 *   - The board fixtures are tiles of the real arcade maze, quoted from
 *     `classic-layout.ts`, so no test here can be right about a toy board and
 *     wrong about the game.
 */
describe('pacmanSystem', () => {
  /**
   * The centre pixel of tile (6, 29): a horizontal corridor along the bottom of
   * the board, walled above and below (row 28 and row 30 are `#` at column 6).
   * Chosen deliberately AWAY from Pac-Man's spawn at (13, 23): a fixture that
   * left him where `startGame` puts him would let an implementation that
   * respawns him, or one that never writes his position at all, pass.
   */
  const CORRIDOR = { x: 52, y: 236 } as const;

  /**
   * The centre pixel of tile (3, 26), which is a T-junction: open left, open
   * right, open UP into row 25, wall below. Turning up from here is a
   * perpendicular turn, so it is legal only on the centre pixel — and the
   * expected position moves on the OTHER AXIS from the facing, which is what
   * makes "he took the turn" and "he kept going" different numbers rather than
   * the same one seen twice.
   */
  const JUNCTION = { x: 28, y: 212 } as const;

  /**
   * The centre pixel of tile (13, 11), the corridor tile directly ABOVE the
   * ghost-house gate at (13, 12).
   */
  const ABOVE_THE_GATE = { x: 108, y: 92 } as const;

  /**
   * TYPE: unit.
   * WHY THIS TYPE: one frame, one actor, one arithmetic result. A whole-frame
   *   integration test would need the pipeline and four ghosts to observe a
   *   single pixel, and would not say which system produced it.
   * MEASURES: that a playing frame advances Pac-Man by exactly the level's
   *   speed, and that the system is silent — it emits no events, because
   *   moving is not an occurrence anything listens for.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3, "Per-level table", row 1:
   *   Pac-Man 80%. Section 2, "Speed: what 80% means": 100% is 320 sub-pixels
   *   per frame, so 0.8 * 320 = 256 = exactly one pixel, leaving carry 0.
   *   Facing right from the centre of tile (6, 29) at (52, 236), one frame ends
   *   at (53, 236).
   * CATCHES: a Pac-Man who does not move at all — the game boots, the maze
   *   draws, the ghosts hunt, and the player's joystick does nothing.
   * LOAD-BEARING: yes — the stub returns the state untouched, so he stays at
   *   (52, 236).
   */
  it('advances Pac-Man by one pixel a frame at level 1, and says nothing', () => {
    const state = buildState({
      pacman: { actor: { position: CORRIDOR, facing: Direction.Right }, animationFrame: 7 },
    });

    const { state: next, events } = pacmanSystem.run(state, frameContext(), []);

    expect(next.pacman.actor.position).toEqual({ x: 53, y: 236 });
    /* 256 sub-pixels is a whole pixel exactly: nothing is left to bank. This is
       the assertion that separates 80% from the frightened 90%, which also
       moves one pixel this frame but banks 32. */
    expect(next.pacman.actor.carrySubPixels).toBe(0);
    /* Seven, not zero: a fixture starting at zero would be satisfied by an
       implementation that assigns 1, or that copies state.frame. */
    expect(next.pacman.animationFrame).toBe(8);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the cheapest possible way to show that the speed is READ
   *   rather than remembered. It needs a second level and nothing else.
   * MEASURES: that the step comes from the LevelSpec in the frame context.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3, "Per-level table", row 5:
   *   Pac-Man 100%. Section 2: 1.0 * 320 = 320 sub-pixels = one pixel with 64
   *   sub-pixels banked. Level 1's 256 would bank 0, and level 5's own
   *   eating-dots row (~87% -> 278) would bank 22, so 64 names exactly one row
   *   of exactly one level.
   * CATCHES: a speed hard-coded to level 1's 80%. Every level from 5 on would
   *   then play at level-1 pace while the ghosts correctly speed up — the game
   *   would get quietly, inexplicably unwinnable, and nothing would crash.
   * LOAD-BEARING: yes.
   */
  it('takes the frame speed from the level spec, not from level 1', () => {
    const state = buildState({
      level: 5,
      pacman: { actor: { position: CORRIDOR, facing: Direction.Right } },
    });

    const { state: next } = pacmanSystem.run(state, frameContext({ spec: levelSpec(5) }), []);

    expect(next.pacman.actor.position).toEqual({ x: 53, y: 236 });
    expect(next.pacman.actor.carrySubPixels).toBe(64);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the freeze is one comparison and one subtraction on one
   *   field. Reproducing it through a real bite would drag in the eat system
   *   and make a failure ambiguous between the two.
   * MEASURES: that a pending freeze costs Pac-Man the whole frame — he does not
   *   move, he banks nothing, and the counter comes down by exactly one.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.2, "The eating freeze: 1 frame
   *   for a dot, 3 for an energizer", quoting the Dossier: _"Every time Pac-Man
   *   eats a regular dot, he stops moving for one frame (1/60th of a
   *   second)... Eating an energizer dot causes Pac-Man to stop moving for
   *   three frames."_ The same section names this system as the consumer: it
   *   "skips the move and decrements". Starting at 3 — the energizer count —
   *   rather than at 1, so that "decrement" and "clear to zero" give different
   *   answers.
   * CATCHES: the gameplay bug this whole field exists to prevent. Without the
   *   freeze Pac-Man keeps his 80% against the ghosts' 75% while eating, so a
   *   player who simply holds a direction can never be caught from behind, and
   *   the entire back half of every level stops being dangerous.
   * LOAD-BEARING: yes — the stub leaves stopFrames at 3.
   */
  it('spends the eating freeze standing still, one frame at a time', () => {
    const state = buildState({
      pacman: {
        actor: { position: CORRIDOR, facing: Direction.Right },
        /* Three: an energizer's freeze (section 8.2). */
        stopFrames: 3,
        animationFrame: 7,
      },
    });

    const { state: next } = pacmanSystem.run(state, frameContext(), []);

    expect(next.pacman.stopFrames).toBe(2);
    /* The literal, not `state.pacman.actor.position`: an implementation that
       moved him a pixel would still equal itself. He is in open corridor
       facing an open tile, so a frame of movement WOULD change this number. */
    expect(next.pacman.actor.position).toEqual({ x: 52, y: 236 });
    expect(next.pacman.actor.carrySubPixels).toBe(0);
    /* [repo convention] `animationFrame` counts the frames Pac-Man was actually
       simulated, so the mouth holds its pose through the bite instead of
       chewing on a Pac-Man who is not moving. Section 8.2 says he "stops
       moving"; treating that as a total stop is this file's reading of it. */
    expect(next.pacman.animationFrame).toBe(7);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: a boundary is a single value, and this is the value.
   * MEASURES: that the LAST frozen frame is still a frozen frame — a count of 1
   *   is spent by standing still, not by moving and zeroing the counter.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.2 — a dot costs exactly one
   *   frame of movement. The eat system runs AFTER this one in the pipeline
   *   (`SystemId` in `system.ts`), so the frame that eats the dot is a frame
   *   Pac-Man moved; the single frame he loses is the NEXT one, when the
   *   counter reads 1. If that frame moves him, the dot cost nothing at all.
   * CATCHES: the off-by-one that silently deletes the freeze — `stopFrames > 1`
   *   instead of `> 0`. A dot would then cost zero frames and an energizer two,
   *   so Pac-Man would be about ten percent faster than the arcade all game:
   *   fast enough to outrun a following ghost, and invisible in every other
   *   test.
   * LOAD-BEARING: yes — the stub leaves stopFrames at 1.
   */
  it('is still frozen on the last frame of the freeze, and moves only after it', () => {
    const state = buildState({
      pacman: {
        actor: { position: CORRIDOR, facing: Direction.Right },
        /* One: a plain dot's freeze (section 8.2). */
        stopFrames: 1,
      },
    });

    const { state: next } = pacmanSystem.run(state, frameContext(), []);

    expect(next.pacman.stopFrames).toBe(0);
    expect(next.pacman.actor.position).toEqual({ x: 52, y: 236 });
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: it is one frame at one junction. The turn RULE has its own
   *   suite in `pacman-turn.test.ts`; what is unproven until here is that this
   *   system hands that rule to the mover at all, and hands it the player's
   *   request.
   * MEASURES: two links of the same chain — that `pendingDirection`, which the
   *   input system writes, reaches `actor.queued`, and that the move is made
   *   with `pacmanTurnPolicy` rather than with a policy that just keeps facing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4, "The queued turn": the
   *   original reads the joystick into a desired direction and applies it the
   *   moment the maze allows; a perpendicular turn is taken at a tile centre.
   *   `pacman.ts` records the wiring — the input system writes
   *   `pendingDirection`, "and pacman-system mirrors it into `actor.queued`
   *   before moving", because a `TurnPolicy` is handed a `TurnContext` that
   *   carries the `Actor` and never the `Pacman`. From the centre of the
   *   junction at (3, 26) = (28, 212), one frame at level 1's 256 sub-pixels
   *   turns up and ends at (28, 211) — one pixel on the OTHER axis. Carrying
   *   straight on would be (27, 212), so the two answers cannot be confused.
   * CATCHES: a Pac-Man who cannot turn. He slides along whichever wall he
   *   started against, the joystick does nothing but reverse him, and the game
   *   is unplayable in a way no type error reports.
   * LOAD-BEARING: yes.
   */
  it('turns onto the direction the player is holding, at the tile centre', () => {
    const state = buildState({
      pacman: {
        actor: { position: JUNCTION, facing: Direction.Left, queued: null },
        /* The player is pushing up. Only the input system writes this field. */
        pendingDirection: Direction.Up,
      },
    });

    const { state: next } = pacmanSystem.run(state, frameContext(), []);

    expect(next.pacman.actor.facing).toBe(Direction.Up);
    expect(next.pacman.actor.position).toEqual({ x: 28, y: 211 });
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: same junction, one field moved — the cheapest way to show
   *   that the mirror does not ERASE.
   * MEASURES: that a queued turn survives a frame in which the player is
   *   holding nothing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4: a queued direction "persists
   *   indefinitely until it is taken or overwritten — it never expires", and
   *   `pacman-turn.ts` states the companion rule that letting go of the
   *   joystick does not stop Pac-Man. A mirror written as
   *   `queued = pendingDirection` would copy a null over a live request, which
   *   is an expiry, and section 8.4 forbids exactly that. Same fixture and same
   *   expected pixel as the test above: (28, 212) turning up ends at (28, 211).
   * CATCHES: the turn you pressed a corridor early being thrown away the
   *   instant your thumb comes off the stick — cornering would demand
   *   frame-perfect input, which is precisely the feel section 8.4 says this
   *   game is buying by keeping the queue.
   * LOAD-BEARING: yes.
   */
  it('keeps a turn already queued when the player is holding nothing', () => {
    const state = buildState({
      pacman: {
        actor: { position: JUNCTION, facing: Direction.Left, queued: Direction.Up },
        pendingDirection: null,
      },
    });

    const { state: next } = pacmanSystem.run(state, frameContext(), []);

    expect(next.pacman.actor.facing).toBe(Direction.Up);
    expect(next.pacman.actor.position).toEqual({ x: 28, y: 211 });
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the door is one boolean in the move request, and this is the
   *   one board position where that boolean is observable.
   * MEASURES: that Pac-Man's move is requested with `mayPassDoor: false`.
   * ORACLE: `maze.ts` states the asymmetry — "ghosts leave the house through
   *   the gate, Pac-Man can never enter it" — and `isWalkable` reads the gate
   *   tile as passable only when the flag is set. Pac-Man stands on the centre
   *   of (13, 11) = (108, 92), directly above the gate at (13, 12), facing down
   *   with down held: the turn policy refuses a direction whose neighbour is
   *   not walkable, and the mover's wall stop then holds him on the centre
   *   pixel. With the flag wrongly true he would step to (108, 93).
   * CATCHES: Pac-Man walking into the ghost house — safe from every ghost that
   *   is out, and able to eat the three inside from point-blank range. It is
   *   the single most game-breaking thing one wrong boolean can do here.
   * LOAD-BEARING: yes, but only because of the animation assertion: the stub
   *   also leaves his position alone, so the position assertion alone would be
   *   a guard. `animationFrame` advancing is what proves the system RAN this
   *   frame and then declined to move him, rather than doing nothing at all.
   */
  it('refuses the ghost-house gate, having run the frame anyway', () => {
    const state = buildState({
      pacman: {
        actor: { position: ABOVE_THE_GATE, facing: Direction.Down, queued: null },
        pendingDirection: Direction.Down,
        animationFrame: 7,
      },
    });

    const { state: next } = pacmanSystem.run(state, frameContext(), []);

    expect(next.pacman.actor.position).toEqual({ x: 108, y: 92 });
    expect(next.pacman.animationFrame).toBe(8);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: four phases, one assertion each. A parameterised loop rather
   *   than four near-identical blocks, because the point IS the uniformity —
   *   "only playing" is one rule, not four.
   * MEASURES: that outside `playing` this system returns the state it was
   *   given — the same OBJECT, not an equal copy — and emits nothing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7, "The round": ready, dying,
   *   levelComplete and gameOver are pauses in which the world does not
   *   simulate. `system.ts` states the identity half: a system that changes
   *   nothing must return the same state object, because `runSystems` threads
   *   state by reference and downstream tests assert identity.
   * CATCHES: a Pac-Man who keeps gliding through the READY! countdown and
   *   through his own death animation — walking into a ghost while the game is
   *   already playing his death, which costs two lives for one mistake, and
   *   drifting off his spawn before the round has begun.
   * LOAD-BEARING: no — the stub returns the state unchanged in every phase, so
   *   this passes against it. It is a deliberate guard, and it is the only test
   *   here that would catch an implementation that never looks at the phase at
   *   all: the fixture is a Pac-Man in open corridor who WOULD move, with a
   *   pending freeze that WOULD be decremented.
   */
  it('does nothing whatsoever outside the playing phase', () => {
    const frozen = [
      RoundPhase.Ready,
      RoundPhase.Dying,
      RoundPhase.LevelComplete,
      RoundPhase.GameOver,
    ];
    expect.assertions(8);

    for (const phase of frozen) {
      const state = buildState({
        phase,
        pacman: {
          actor: { position: CORRIDOR, facing: Direction.Right },
          stopFrames: 3,
        },
      });

      const { state: next, events } = pacmanSystem.run(state, frameContext(), []);

      expect(next).toBe(state);
      expect(events).toEqual([]);
    }
  });
});
