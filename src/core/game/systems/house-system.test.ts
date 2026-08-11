import { describe, expect, it } from 'vitest';

import { GhostId } from '../../ghost/ghost-id.ts';
import { GhostPhase } from '../../ghost/ghost.ts';
import { buildState } from '../../testing/state-builder.ts';
import { type GameEvent } from '../game-event.ts';
import { RoundPhase } from '../game-phase.ts';
import { type GameState } from '../game-state.ts';

import { houseSystem } from './house-system.ts';
import { frameContext } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The house system is the door of the ghost house, and the door is the pacing of
 * the whole game. Blinky is on the board from the first frame; Pinky, Inky and
 * Clyde are penned, and how quickly they come out is the difference between an
 * opening a beginner survives and one they do not.
 *
 * The rules themselves are already written, tested and green in
 * `ghost/house.ts` — `houseAfterFrame` ages the stall timer, `houseAfterDot`
 * resets it and advances the global counter, and `releaseDecision` names at most
 * one ghost. So this file does NOT re-test the level-1 limits of 0/30/60 or the
 * 7/17/32 global ladder; `house.test.ts` owns those, and asserting them twice
 * would mean two places to edit when a ROM disassembly corrects one of them.
 *
 * What is only true HERE, and therefore all this file checks, is the WIRING —
 * the three joints where a thin adapter goes wrong:
 *
 *   1. WHEN the counters move. The stall timer ages on FRAMES and resets on
 *      DOTS, and the dot arrives as a `pelletEaten` EVENT from the eat system
 *      earlier in the same frame. Events are the only channel between systems,
 *      so this file always speaks through `incoming` and never through
 *      `state.pellets`.
 *   2. WHETHER the decision sees THIS frame's counters. The release is decided
 *      from the house AFTER it has been aged, not before — one line's difference,
 *      and every ghost leaves one frame late.
 *   3. WHAT a release does: exactly one ghost moves from `InHouse` to
 *      `LeavingHouse`, and exactly one `ghostReleased` is emitted so the audio
 *      channel hears it without importing this module.
 *
 * Every test is a unit. The alternative — eating thirty real dots through the
 * pipeline to see Inky move — would take a minute of simulated play to assert
 * one enum, and could not check the frame before the boundary at all.
 */

/**
 * A ghost out on the board, and therefore never a release candidate.
 *
 * `dotCounterActive: false` mirrors what `spawnGhost` does for a ghost that is
 * not waiting: a ghost on the board has nothing to count.
 */
const OUT = { phase: GhostPhase.Hunting, dotCounterActive: false } as const;

/** A ghost waiting inside the house, with `dots` on its personal counter. */
function waiting(dots: number): {
  readonly phase: GhostPhase;
  readonly dotCounter: number;
  readonly dotCounterActive: boolean;
} {
  return { phase: GhostPhase.InHouse, dotCounter: dots, dotCounterActive: true };
}

/**
 * The event the eat system emits when Pac-Man swallows a dot.
 *
 * The tile and the remaining count are real but arbitrary: this system reads
 * only the `kind`. They are here because the event carries them for the siren,
 * and a fixture that omitted them would not compile — which is the compiler
 * enforcing that the audio channel and the rules cannot drift apart.
 */
const DOT_EATEN: GameEvent = { kind: 'pelletEaten', tile: { col: 12, row: 23 }, remaining: 243 };

/**
 * An event that is NOT a dot, and one that genuinely arrives here.
 *
 * The mode system runs immediately before the house system in `GAME_PIPELINE`,
 * so a fright ending in the same frame is an ordinary thing to find in
 * `incoming`. Used to prove the system discriminates on `kind` rather than on
 * "did anything at all happen this frame".
 */
const NOT_A_DOT: GameEvent = { kind: 'frightenedEnded' };

describe('houseSystem', () => {
  /**
   * TYPE: unit.
   * WHY THIS TYPE: one frame, one field. Reaching four seconds through the
   *   pipeline would mean 240 ticks of a full game to assert an increment.
   * MEASURES: with no dot eaten this frame the stall timer ages by exactly one,
   *   and nobody leaves the house.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.3, "The four-second timer" — the
   *   release fires when Pac-Man eats NOTHING for 240 frames (levels 1-4), so
   *   the counter it fires on must be a count of frames. Section 12.1,
   *   "Personal dot counters", supplies the other half: at level 1 Inky's limit
   *   is 30 dots and Clyde's is 60, so a house at 0 dots and 42 frames releases
   *   nobody.
   * CATCHES: a stall timer that never ages. The four-second rule then never
   *   fires in a real game — a player who parks in a corner and stops eating
   *   faces one ghost for the rest of the level — while `house.test.ts` stays
   *   green throughout, because the rule it tests is fine and nobody is calling
   *   it.
   * LOAD-BEARING: yes — the stub returns the state untouched, so the timer is
   *   still 41.
   */
  it('ages the stall timer by one frame when no dot was eaten, and releases nobody', () => {
    const state = buildState({
      /* 41 rather than 0: a timer that started at zero could not tell "aged by
         one" from "reset by a bug", which is the very confusion the next test
         is about. */
      house: { globalCounter: 0, globalCounterActive: false, framesSinceDot: 41 },
      ghosts: {
        [GhostId.Blinky]: OUT,
        [GhostId.Pinky]: OUT,
        [GhostId.Inky]: waiting(0),
        [GhostId.Clyde]: waiting(0),
      },
    });

    const { state: next, events } = houseSystem.run(state, frameContext(), []);

    expect(next.house.framesSinceDot).toBe(42);
    expect(next.ghosts[GhostId.Inky].phase).toBe(GhostPhase.InHouse);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the claim is about which INPUT the system reads, and the
   *   cheapest way to state that is to hand it two different inputs and compare
   *   the two answers.
   * MEASURES: the same state run twice. With only a `frightenedEnded` in
   *   `incoming` the timer ages; with a `pelletEaten` also present it resets to
   *   zero. The dot is deliberately the SECOND element.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.3 — "The timer resets every time
   *   a dot is eaten", and only then.
   * CATCHES: three imposters that all look reasonable. (a) "any incoming event
   *   means something happened" resets the timer on the frame a fright ends, so
   *   the four-second release can never fire during play. (b) `incoming[0].kind
   *   === 'pelletEaten'` misses every dot eaten in a frame where anything else
   *   spoke first — an intermittent bug of the worst kind. (c) an implementation
   *   that resets on every frame regardless: the timer would read 0 here and 0
   *   in the test above.
   * LOAD-BEARING: yes — the stub leaves 41 in both halves, and neither expected
   *   value is 41.
   */
  it('resets the stall timer only when a pelletEaten event arrived, whatever else did', () => {
    const state = buildState({
      house: { globalCounter: 0, globalCounterActive: false, framesSinceDot: 41 },
      ghosts: {
        [GhostId.Blinky]: OUT,
        [GhostId.Pinky]: OUT,
        [GhostId.Inky]: waiting(0),
        [GhostId.Clyde]: waiting(0),
      },
    });

    /* The pellet FIELD is the full 244-dot board in both runs — the only thing
       that differs is the event list. That is the point: `incoming` is the
       inter-system channel, and a system that went looking at `state.pellets`
       instead would give the same answer twice. */
    const quiet = houseSystem.run(state, frameContext(), [NOT_A_DOT]);
    const withDot = houseSystem.run(state, frameContext(), [NOT_A_DOT, DOT_EATEN]);

    expect(quiet.state.house.framesSinceDot).toBe(42);
    expect(withDot.state.house.framesSinceDot).toBe(0);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: a boundary is only pinned by asserting BOTH sides of it, and
   *   the two sides here are one frame apart. Nothing but a unit can sit on the
   *   frame before.
   * MEASURES: the level-1 stall boundary, decided from the house AFTER this
   *   frame's ageing. At 238 the aged timer is 239 and nobody moves; at 239 it
   *   is 240 and INKY — not Blinky, not Pinky — steps out, with exactly one
   *   event to say so, while Clyde stays penned.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.3 — 240 frames on levels 1-4 —
   *   with section 12.4, "Order and rate": at most one ghost per frame, the
   *   earliest in GHOST_ORDER still in phase `InHouse`. Pinky is already out
   *   here, so the earliest still waiting is Inky.
   * CATCHES: (a) the decision taken from the house BEFORE it was aged, which
   *   delays every release in the game by one frame and, more visibly, makes the
   *   two tests above and this one disagree about what "240 frames" means.
   *   (b) releasing the first ghost of the record (Blinky, who is the first key
   *   `startGame` inserts) or always Pinky, rather than the ghost the rule
   *   named. A hunting Blinky teleported back to the door mid-chase is the
   *   symptom, and it happens every 240 frames.
   *   (c) opening the door for everyone at once: three ghosts abreast out of the
   *   house, which no single-ghost fixture would reveal.
   *   (d) the phase changed with no event, so the release is silent and the
   *   audio director never hears it.
   * LOAD-BEARING: yes — the stub leaves Inky in the house and emits nothing.
   */
  it('releases one ghost — the earliest still waiting — on the frame the stall timer reaches 240', () => {
    const stalledAt = (frames: number): GameState =>
      buildState({
        house: { globalCounter: 0, globalCounterActive: false, framesSinceDot: frames },
        ghosts: {
          [GhostId.Blinky]: OUT,
          /* Pinky out on the board so that the ghost the rule names is neither
             the first key of the record nor the first name in GHOST_ORDER. */
          [GhostId.Pinky]: OUT,
          /* Both far below their level-1 limits of 30 and 60, so the stall timer
             is the only rule that can fire. */
          [GhostId.Inky]: waiting(0),
          [GhostId.Clyde]: waiting(0),
        },
      });

    const before = houseSystem.run(stalledAt(238), frameContext(), []);

    expect(before.state.ghosts[GhostId.Inky].phase).toBe(GhostPhase.InHouse);
    expect(before.events).toEqual([]);

    const onTime = houseSystem.run(stalledAt(239), frameContext(), []);

    expect(onTime.state.ghosts[GhostId.Inky].phase).toBe(GhostPhase.LeavingHouse);
    expect(onTime.state.ghosts[GhostId.Clyde].phase).toBe(GhostPhase.InHouse);
    expect(onTime.state.ghosts[GhostId.Blinky].phase).toBe(GhostPhase.Hunting);
    expect(onTime.events).toEqual([{ kind: 'ghostReleased', ghost: GhostId.Inky }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the same frame with and without one event, which is the only
   *   way to show that the counter moved BECAUSE of the dot.
   * MEASURES: after a life has been lost the global counter stands at 6. A dot
   *   arrives: the counter reaches 7 and Pinky leaves in that same frame. With
   *   no dot the counter stays at 6 and nobody leaves — every personal counter
   *   is at 999, far past every limit in section 12.1, so nothing but the global
   *   count can be releasing anyone.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.2, "The global counter, after a
   *   life is lost" — Pinky 7, Inky 17, Clyde 32, with the personal counters
   *   ignored entirely while it is active.
   * CATCHES: the release decided from the house as it was at the START of the
   *   frame, so the seventh dot does not free Pinky and only the eighth does.
   *   That is invisible in ordinary play and lethal in the case the rule exists
   *   for — the re-entry after a death, where a whole extra dot of delay against
   *   a Blinky already on the board is the difference between escaping the
   *   spawn area and not. It also catches a system that advances the global
   *   counter every frame instead of every dot, which would empty the house in
   *   half a second after the first death.
   * LOAD-BEARING: yes — the stub leaves the counter at 6 and Pinky in the house.
   */
  it('advances the global counter on a dot and releases from the value it has after the advance', () => {
    const state = buildState({
      house: { globalCounter: 6, globalCounterActive: true, framesSinceDot: 0 },
      ghosts: {
        [GhostId.Blinky]: OUT,
        [GhostId.Pinky]: waiting(999),
        [GhostId.Inky]: waiting(999),
        [GhostId.Clyde]: waiting(999),
      },
    });

    const fed = houseSystem.run(state, frameContext(), [DOT_EATEN]);

    expect(fed.state.house.globalCounter).toBe(7);
    expect(fed.state.ghosts[GhostId.Pinky].phase).toBe(GhostPhase.LeavingHouse);
    expect(fed.events).toEqual([{ kind: 'ghostReleased', ghost: GhostId.Pinky }]);

    const starved = houseSystem.run(state, frameContext(), []);

    expect(starved.state.house.globalCounter).toBe(6);
    expect(starved.state.ghosts[GhostId.Pinky].phase).toBe(GhostPhase.InHouse);
    expect(starved.events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the claim is that one argument is passed through, and the
   *   only observable difference it makes is 60 frames of waiting.
   * MEASURES: level 5, where the stall timeout is 180 frames rather than 240.
   *   At 179 the aged timer is 180 and Pinky is freed; at 178 it is 179 and
   *   nobody is. The global counter is active and empty so that no dot counter
   *   can fire — from level 3 on every personal limit is 0, so a penned ghost
   *   would otherwise walk out on frame one and the timeout would prove nothing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.3 — four seconds on levels 1-4
   *   and three from level 5, which section 1 converts at 60Hz to 240 and 180
   *   frames.
   * CATCHES: `level` not passed to the rule, or hard-coded to 1. Level 5 onward
   *   then opens its house a third slower than the arcade — the ramp the machine
   *   uses to get harder simply stops — and every test above stays green,
   *   because they are all level 1.
   * LOAD-BEARING: yes — the stub never releases anybody.
   */
  it('takes the level from the state: the stall timeout is 180 frames from level 5, not 240', () => {
    const stalledOnFive = (frames: number): GameState =>
      buildState({
        level: 5,
        house: { globalCounter: 0, globalCounterActive: true, framesSinceDot: frames },
        ghosts: {
          [GhostId.Blinky]: OUT,
          [GhostId.Pinky]: waiting(0),
          [GhostId.Inky]: waiting(0),
          [GhostId.Clyde]: waiting(0),
        },
      });

    const before = houseSystem.run(stalledOnFive(178), frameContext(), []);

    expect(before.state.ghosts[GhostId.Pinky].phase).toBe(GhostPhase.InHouse);
    expect(before.events).toEqual([]);

    const onTime = houseSystem.run(stalledOnFive(179), frameContext(), []);

    expect(onTime.state.ghosts[GhostId.Pinky].phase).toBe(GhostPhase.LeavingHouse);
    expect(onTime.events).toEqual([{ kind: 'ghostReleased', ghost: GhostId.Pinky }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: an identity assertion. `runSystems` threads one state object
   *   through the whole frame without copying it, and only a `toBe` can see the
   *   difference between "nothing changed" and "everything was copied and then
   *   put back".
   * MEASURES: in the death freeze, with a stall timer long past any threshold
   *   and a ghost sitting in the house, the system returns the VERY SAME state
   *   object and no events.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7 — the READY! pause, the death
   *   freeze and the maze flash are phases in which time passes and the world
   *   does not simulate. `playing` is the only phase in which it does.
   * CATCHES: a house clock that keeps running while Pac-Man dies. Four seconds
   *   of the 180-frame death animation and the 120-frame READY! pause is easily
   *   enough to trip the stall release, so the player watches a ghost stroll out
   *   of the house during the death spin and then meets it the instant control
   *   returns. It also catches a defensive `{ ...state }` on the do-nothing
   *   path, which is invisible to every value assertion and quietly defeats the
   *   identity checks the pipeline relies on.
   * LOAD-BEARING: no — the stub returns `unchanged(state)` and emits nothing, so
   *   this passes before a line is written. It is a guard, kept deliberately:
   *   it is the only test here that constrains what happens outside `playing`,
   *   and the only one that pins the object identity.
   */
  it('does not run the house clock outside play, and returns the same state object', () => {
    const state = buildState({
      phase: RoundPhase.Dying,
      phaseFramesLeft: 90,
      house: { globalCounter: 0, globalCounterActive: false, framesSinceDot: 9_999 },
      ghosts: {
        [GhostId.Blinky]: OUT,
        [GhostId.Pinky]: OUT,
        [GhostId.Inky]: waiting(0),
        [GhostId.Clyde]: waiting(0),
      },
    });

    const { state: next, events } = houseSystem.run(state, frameContext(), [DOT_EATEN]);

    expect(next).toBe(state);
    expect(events).toEqual([]);
  });
});
