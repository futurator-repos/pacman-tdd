import { describe, expect, it } from 'vitest';

import { buildState } from '../../testing/state-builder.ts';
import { RoundPhase } from '../game-phase.ts';

import { phaseSystem } from './phase-system.ts';
import { frameContext } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The phase system owns the answer to "is the world allowed to move right now?"
 *
 * That question sounds like bookkeeping and is actually gameplay. The READY!
 * pause, the freeze when Pac-Man is caught, and the maze flash after the last
 * dot are all phases in which time passes but nothing simulates. Get this
 * wrong and either the ghosts keep hunting through the death animation — the
 * player loses two lives to one mistake — or the countdown never ends and the
 * game hangs on a screen that looks fine.
 *
 * Every other system asks this one for permission, so it runs second, right
 * after input.
 */
describe('phaseSystem', () => {
  /**
   * TYPE: unit.
   * WHY THIS TYPE: a countdown is arithmetic on one field. Driving it through
   *   a whole frame would need a maze, four ghosts and a pellet field to assert
   *   a subtraction.
   * MEASURES: that a timed phase loses exactly one frame per tick.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7 — the pauses are measured in
   *   frames at 60Hz, and one tick is one frame by definition.
   * CATCHES: a countdown that does not count, which hangs the game on READY!
   *   forever with no crash and no error.
   * LOAD-BEARING: yes — the stub returns the state untouched.
   */
  it('spends one frame of a timed phase per tick', () => {
    const state = buildState({ phase: RoundPhase.Ready, phaseFramesLeft: 120 });

    const { state: next } = phaseSystem.run(state, frameContext(), []);

    expect(next.phaseFramesLeft).toBe(119);
  });

  /**
   * TYPE: unit.
   * MEASURES: that the countdown reaching zero moves the game to Playing, and
   *   announces it.
   * ORACLE: section 7 — READY! is followed by play.
   * CATCHES: a phase that expires without transitioning, freezing the game
   *   permanently at zero.
   * LOAD-BEARING: yes.
   */
  it('starts play when the ready countdown expires, and says so', () => {
    const state = buildState({ phase: RoundPhase.Ready, phaseFramesLeft: 1 });

    const { state: next, events } = phaseSystem.run(state, frameContext(), []);

    expect(next.phase).toBe(RoundPhase.Playing);
    /* The event is not decoration: it is how the audio decision knows to stop
       the intro jingle without importing this module. */
    expect(events).toContainEqual({ kind: 'phaseChanged', phase: RoundPhase.Playing });
  });

  /**
   * TYPE: unit.
   * MEASURES: that Playing does not tick down toward anything.
   * ORACLE: section 7 — play continues until something ends it. Its length is
   *   not a timer.
   * CATCHES: an implementation that decrements unconditionally, which would
   *   drive phaseFramesLeft negative during play and then transition out of
   *   Playing at a moment governed by nothing.
   * LOAD-BEARING: no — the stub also leaves Playing alone. A guard, and a
   *   deliberate one: it is the only test that would catch "decrement always".
   */
  it('leaves the playing phase alone, because play is not on a timer', () => {
    const state = buildState({ phase: RoundPhase.Playing, phaseFramesLeft: 0 });

    const { state: next, events } = phaseSystem.run(state, frameContext(), []);

    expect(next.phase).toBe(RoundPhase.Playing);
    expect(next.phaseFramesLeft).toBe(0);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * MEASURES: that the death pause leads back into Ready, not straight into
   *   Playing.
   * ORACLE: section 7 — after a death the round restarts with the READY! pause,
   *   which is what gives the player a moment to see the board again.
   * CATCHES: dropping the player straight back into a moving maze, which reads
   *   as an instant second death and is the difference between a fair game and
   *   an unfair one.
   * LOAD-BEARING: yes.
   */
  it('returns to the ready pause after the death animation, not straight to play', () => {
    const state = buildState({ phase: RoundPhase.Dying, phaseFramesLeft: 1, lives: 2 });

    const { state: next } = phaseSystem.run(state, frameContext(), []);

    expect(next.phase).toBe(RoundPhase.Ready);
  });

  /**
   * TYPE: unit.
   * MEASURES: that game over is terminal.
   * ORACLE: a stated design invariant — there is no phase after gameOver, and
   *   the shell restarts by building a new state rather than by transitioning.
   * CATCHES: a countdown that runs past the end of the game and wraps into
   *   another round with no lives, which is exactly the kind of state a player
   *   reaches by leaving the machine on.
   * LOAD-BEARING: no — the stub is also terminal. Guard.
   */
  it('stays in game over, which is terminal', () => {
    const state = buildState({ phase: RoundPhase.GameOver, phaseFramesLeft: 0, lives: 0 });

    const { state: next, events } = phaseSystem.run(state, frameContext(), []);

    expect(next.phase).toBe(RoundPhase.GameOver);
    expect(events).toEqual([]);
  });
});
