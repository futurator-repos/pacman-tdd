import { describe, expect, it } from 'vitest';

import { levelSpec } from '../rules/level-table.ts';
import { createScriptedRng } from '../testing/scripted-rng.ts';
import { buildState } from '../testing/state-builder.ts';
import { corridorMaze } from '../testing/tiny-maze.ts';

import { type GameEvent, NO_EVENTS } from './game-event.ts';
import { NEUTRAL_INPUT } from './game-input.ts';
import { type GameState } from './game-state.ts';
import { type FrameContext, type System, SystemId, runSystems, unchanged } from './system.ts';

/**
 * The plumbing every system runs through.
 *
 * There is no game in this file — no maze to speak of, no ghosts, no pellets.
 * That is deliberate: what is under test is the CONTRACT that twelve real
 * systems will rely on, and the fastest way to state a contract is with fake
 * systems that do one visible thing each. A test that used the real pipeline
 * here would be testing the real pipeline, and would still not tell you whether
 * the fold threaded the state or copied it.
 *
 * Three properties, three tests, and each one is a bug that would otherwise be
 * found in slice s11 with four subsystems in the frame and no idea which of
 * them was lying.
 */

/** A frame's worth of context. Nothing in this file reads any of it — a hand-drawn corridor,
    level 1's spec, no input and an exhausted Rng are enough for systems that ignore all four. */
const CONTEXT: FrameContext = {
  maze: corridorMaze(),
  spec: levelSpec(1),
  input: NEUTRAL_INPUT,
  rng: createScriptedRng([]),
};

const CAUGHT: GameEvent = { kind: 'pacmanCaught', ghost: 'blinky' };
const DIED: GameEvent = { kind: 'pacmanDied', livesLeft: 2 };
const OVER: GameEvent = { kind: 'gameOver', score: 4260 };

/**
 * A fake system that pushes one digit onto the score and emits one event.
 *
 * The score arithmetic is `score * 10 + digit`, which makes the RESULT record
 * the ORDER: run 1 then 2 then 3 and the score reads 123, while any other order
 * reads something else. A test that added the digits could not tell 1,2,3 from
 * 3,2,1 — and system order is the single thing this fold exists to get right.
 */
function digitSystem(id: SystemId, digit: number, event: GameEvent): System {
  return {
    id,
    run(state: GameState) {
      return { state: { ...state, score: state.score * 10 + digit }, events: [event] };
    },
  };
}

/** A fake system that does nothing at all and says so. */
function idleSystem(id: SystemId): System {
  return {
    id,
    run(state: GameState) {
      return unchanged(state);
    },
  };
}

describe('NEUTRAL_INPUT', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One constant, one assertion. There is nothing cheaper and
   *   nothing to integrate.
   * MEASURES: That the do-nothing input really does nothing: no direction held,
   *   and neither edge-triggered button reading as pressed.
   * ORACLE: docs/ARCHITECTURE.md, "GameInput and Replay", which declares
   *   NEUTRAL_INPUT as `{ direction: null, startPressed: false, pausePressed:
   *   false }`, plus the edge-trigger contract stated in game-input.ts.
   * CATCHES: A `startPressed: true` slipping into the shared constant. Every
   *   test in slices s10 to s12 that "does nothing for ninety frames" would
   *   silently be mashing the start button ninety times, and the phase tests
   *   would pass for the wrong reason.
   * LOAD-BEARING: no — a GUARD, predicted to PASS in the red phase. The correct
   *   value of this constant is three falsy fields, which is also what an inert
   *   one would be, so the assertion is trivially satisfied: docs/TDD-FINDINGS.md
   *   category (b), WEAK, not (c). It pins nothing today and is kept anyway as a
   *   regression net around a constant that forty later tests trust without
   *   looking at — a `startPressed: true` added here in six months does fail it.
   */
  it('asks for nothing: no direction held and neither edge triggered', () => {
    expect(NEUTRAL_INPUT).toEqual({
      direction: null,
      startPressed: false,
      pausePressed: false,
    });
  });
});

describe('runSystems', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Three fake systems make the ordering VISIBLE in a single
   *   number and a single array. Using real systems would need a real world and
   *   would still leave the fold itself unasserted.
   * MEASURES: Both halves of what the fold promises — the state produced by one
   *   system is the state given to the next, and the events come back
   *   concatenated in emission order.
   * ORACLE: The contract stated in docs/ARCHITECTURE.md, "System, FrameContext,
   *   stepFrame, tick": stepFrame is a fold over the pipeline threading state
   *   and accumulating events, and the returned events are exactly the
   *   concatenation of what each system emitted. Digits 1, 2, 3 applied in order
   *   to a score of 0 give 123 by ordinary arithmetic.
   * CATCHES: A fold that passes the ORIGINAL state to every system and keeps
   *   only the last result — score 3 instead of 123. Every system would then
   *   appear to work in its own unit test while the frame as a whole discarded
   *   eleven twelfths of its work, and the symptom (Pac-Man moves but never
   *   eats) would look like an eating bug.
   * LOAD-BEARING: yes — the stub runs nothing, so the score stays 0 and no
   *   events come back.
   */
  it('threads each system into the next and returns the events in emission order', () => {
    const start = buildState({ score: 0 });

    const result = runSystems(
      [
        digitSystem(SystemId.Input, 1, CAUGHT),
        digitSystem(SystemId.Phase, 2, DIED),
        digitSystem(SystemId.Pacman, 3, OVER),
      ],
      start,
      CONTEXT,
    );

    expect(result.state.score).toBe(123);
    expect(result.events).toEqual([CAUGHT, DIED, OVER]);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The thing being measured is what each system was HANDED,
   *   which no return value reveals. Three recording fakes expose all three
   *   views in one array, so a single assertion shows the accumulation building
   *   up. This is a genuine use for a spy: `incoming` is an input, not an
   *   implementation detail.
   * MEASURES: That each system receives every event emitted EARLIER in the same
   *   frame — nothing for the first, the first's events for the second, and both
   *   for the third.
   * ORACLE: The `System` contract in docs/ARCHITECTURE.md: "`incoming` is every
   *   event emitted earlier this frame, which is how the life system hears about
   *   a death without importing the collision system."
   * CATCHES: A fold that hands every system an empty list, or one that hands on
   *   only the previous system's events instead of all of them. The life system
   *   would never see the collision system's `pacmanCaught`, and Pac-Man would
   *   be caught by a ghost and simply carry on — a bug with no failing unit test
   *   anywhere, because both systems are individually correct.
   * LOAD-BEARING: yes — the stub never runs a system, so nothing is recorded at
   *   all and the expected three views meet an empty array.
   */
  it('hands each system every event emitted earlier in the same frame', () => {
    const seenByEachSystem: (readonly GameEvent[])[] = [];

    const recordingSystem = (id: SystemId, event: GameEvent): System => ({
      id,
      run(state: GameState, _ctx: FrameContext, incoming: readonly GameEvent[]) {
        seenByEachSystem.push([...incoming]);
        return { state, events: [event] };
      },
    });

    runSystems(
      [
        recordingSystem(SystemId.CollisionEarly, CAUGHT),
        recordingSystem(SystemId.Life, DIED),
        recordingSystem(SystemId.Level, OVER),
      ],
      buildState(),
      CONTEXT,
    );

    expect(seenByEachSystem).toEqual([[], [CAUGHT], [CAUGHT, DIED]]);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: An identity assertion — `toBe`, not `toEqual` — which is
   *   only expressible at this level. No integration test can see the
   *   difference between a state and a copy of it.
   * MEASURES: That the fold threads the state object through BY REFERENCE. The
   *   object the middle system returned is the object that comes out, untouched
   *   by the idle systems on either side of it.
   * ORACLE: The stated invariant in system.ts and docs/ARCHITECTURE.md: a
   *   system that changes nothing returns the same state, and the fold does not
   *   copy. Object identity is the only observable form of "did not copy".
   * CATCHES: A defensive `{ ...state }` somewhere in the fold. Every value
   *   assertion in the project would still pass, so nothing would go red — but
   *   sixty allocations of the whole world per second would be silently created,
   *   and every future `toBe` identity check (the cheap way to assert "this
   *   frame changed nothing") would become impossible to write.
   *   Note the shape: the expected object is the one a system RETURNED, not the
   *   one that went in — so a fold that ignores its systems and returns its
   *   argument fails here too, which is exactly what the stub does.
   * LOAD-BEARING: yes — the stub returns the state it was given, not the
   *   replacement the middle system produced.
   */
  it('threads the state by reference: a system that changes nothing changes nothing', () => {
    const start = buildState();
    const replacement: GameState = { ...start, score: 999 };

    const result = runSystems(
      [
        idleSystem(SystemId.Input),
        { id: SystemId.Pacman, run: () => ({ state: replacement, events: NO_EVENTS }) },
        idleSystem(SystemId.Life),
      ],
      start,
      CONTEXT,
    );

    expect(result.state).toBe(replacement);
    expect(result.events).toEqual([]);
  });
});
