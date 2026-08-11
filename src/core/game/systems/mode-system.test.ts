import { describe, expect, it } from 'vitest';

import { GhostId, GHOST_ORDER } from '../../ghost/ghost-id.ts';
import { GhostPhase } from '../../ghost/ghost.ts';
import { GlobalMode } from '../../rules/mode-schedule.ts';
import { buildState } from '../../testing/state-builder.ts';
import { RoundPhase } from '../game-phase.ts';

import { modeSystem } from './mode-system.ts';
import { frameContext } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The mode system owns the one clock the player can see without being told
 * about it: the alternation between scatter — the ghosts wander off to their
 * corners and the board opens up — and chase, when all four turn round and come
 * for Pac-Man. Every experienced player reads that flip off the screen and uses
 * it, which is why the arcade forces every ghost to REVERSE on the boundary
 * (docs/ARCADE-REFERENCE.md section 4, "Reversal"): the turn is the tell.
 *
 * The rule itself already exists and is green — `advanceModes` in
 * `src/core/rules/mode-schedule.ts`, pinned against the three arcade tables by
 * `mode-schedule.test.ts`. This system is a thin adapter, so this file does not
 * re-prove the rule. It tests the four things only the adapter can get wrong:
 *
 *   1. that the clock is asked to advance at all, and only while the round is
 *      actually being played;
 *   2. that the pause during fright survives the trip through the system,
 *      because a clock that keeps ticking under a power pellet spends the
 *      player's scatter time and drifts every later wave earlier — a bug no
 *      single frame of play looks wrong in;
 *   3. that `reversalRequired` is translated into a flag on ALL FOUR ghosts,
 *      not on the one a loop happened to end on;
 *   4. that the two events named in docs/ARCHITECTURE.md ("emits modeChanged on
 *      a flip and frightenedEnded on the last fright frame") are emitted once
 *      each, on the right frame, carrying the right payload.
 *
 * Every fixture below therefore sits ONE FRAME BEFORE the interesting moment
 * with a wave clock that is nowhere near zero, so an implementation that resets
 * the clock, restarts it, or double-advances it fails an equality rather than
 * quietly agreeing with a fixture that could not tell the difference.
 */
describe('modeSystem', () => {
  /**
   * TYPE: unit.
   * WHY THIS TYPE: one frame of a counter, read straight off the state. Driving
   *   this through the pipeline would add eleven other systems to an assertion
   *   about a single addition, and any of them could break it.
   * MEASURES: that an ordinary playing frame spends exactly one frame of the
   *   current wave, leaves the wave index alone, emits nothing, and queues no
   *   reversal.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4, "The three tables" and repo
   *   tie-break 3 — level 1 wave 1 is chase for 1200 frames, so frame 501 of it
   *   is an unremarkable frame in the middle: the wave flips only when the
   *   frames spent REACH 1200.
   * CATCHES: a wave clock that never moves. Scatter never ends, the ghosts
   *   circle their corners forever, and the game becomes unlosable — while
   *   every unit test of `advanceModes` stays green, because nothing ever calls
   *   it.
   * LOAD-BEARING: yes — the stub returns the state untouched, so waveFrames
   *   stays 500.
   */
  it('spends one frame of the current wave on an ordinary playing frame', () => {
    /* 500, not 0: a fixture starting at zero cannot tell "advance by one" from
       "reset to zero and then advance by one". */
    const state = buildState({ modes: { waveIndex: 1, waveFrames: 500, frightenedFramesLeft: 0 } });

    const { state: next, events } = modeSystem.run(state, frameContext(), []);

    expect(next.modes).toEqual({ waveIndex: 1, waveFrames: 501, frightenedFramesLeft: 0 });
    expect(events).toEqual([]);
    /* A reversal is an EDGE. A system that queued one every frame would leave
       the ghosts vibrating on the spot at every tile centre. */
    expect(next.ghosts[GhostId.Blinky].reverseQueued).toBe(false);
  });

  /**
   * TYPE: integration (two modules: the wave clock and the ghost record).
   * WHY THIS TYPE: the behaviour IS the wiring. `advanceModes` reporting
   *   `reversalRequired` and the ghosts carrying `reverseQueued` are separately
   *   green already; what nothing else can see is whether this system carries
   *   the one into the other. Still no pipeline and no second system — the
   *   state comes from the builder.
   * MEASURES: that the 420th frame of level 1's opening scatter flips the wave
   *   to chase, restarts the wave frame count at zero, queues a reversal on
   *   each of the four ghosts individually, and emits exactly one modeChanged
   *   naming the NEW mode and the NEW index.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4, "The three tables", Level 1:
   *   wave 0 is scatter for 7 s = 420 frames and wave 1 is chase for 20 s =
   *   1200 frames; repo tie-break 3 — "a 420-frame wave is flipped by the 420th
   *   advance, and the new wave's frame count starts at 0"; and "Reversal" —
   *   "Ghosts are forced to reverse direction by the system anytime the mode
   *   changes from ... scatter-to-chase".
   * CATCHES: the flag set on whichever ghost a loop finished on, or on none of
   *   them. The reversal that tells the player the hunt has begun never
   *   happens, three ghosts keep walking away while one turns round, and both
   *   the schedule's own unit test and the reversal-execution test in
   *   ghost-system still pass in isolation.
   * LOAD-BEARING: yes.
   */
  it('flips the wave on the 420th frame of level 1 scatter, turning every ghost round', () => {
    expect.assertions(7);
    const state = buildState({
      /* 419 spent: this run's 420th frame is the one that flips it. */
      modes: { waveIndex: 0, waveFrames: 419, frightenedFramesLeft: 0 },
      /* Pinky is deliberately NOT in her opening state. A system that rebuilds
         the ghost record from spawns instead of copying it would pass every
         reverseQueued assertion below and silently resurrect an eaten ghost. */
      ghosts: { [GhostId.Pinky]: { phase: GhostPhase.Eyes } },
    });

    const { state: next, events } = modeSystem.run(state, frameContext(), []);

    expect(next.modes).toEqual({ waveIndex: 1, waveFrames: 0, frightenedFramesLeft: 0 });
    /* The payload is the mode the ghosts are in NOW — chase — not the scatter
       they just left, and index 1, not 0. An implementation that reports the
       state it read rather than the state it produced fails both fields. */
    expect(events).toEqual([{ kind: 'modeChanged', mode: GlobalMode.Chase, waveIndex: 1 }]);
    for (const id of GHOST_ORDER) {
      expect(next.ghosts[id].reverseQueued).toBe(true);
    }
    /* The in-house and eyes exemptions belong to the ghost system, which acts
       on the flag; queueing is unconditional, so Pinky keeps her phase AND gets
       the flag. */
    expect(next.ghosts[GhostId.Pinky].phase).toBe(GhostPhase.Eyes);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the claim is about two numbers on one frame, and it is
   *   sharpest when nothing else is moving. Observed through play it would take
   *   several seconds of frames and would then be a drift, not a diff.
   * MEASURES: that while the fright timer is running the wave clock does not
   *   advance at all — the fright timer alone counts down — and that no wave
   *   flip and no event escape.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4, "Fright pauses the clock",
   *   quoting the Dossier: "If the ghosts enter frightened mode, the
   *   scatter/chase timer is paused ... and the scatter/chase timer resumes",
   *   plus repo tie-break 1 — the wave clock advances on a frame iff
   *   frightenedFramesLeft is 0 at the START of it.
   * CATCHES: a system that advances both clocks together. On this very fixture
   *   that bug flips the wave a frame early and fires a modeChanged nobody
   *   asked for; in a real game it costs the player several seconds of scatter
   *   per power pellet, so the late waves arrive early and the board gets
   *   harder than the arcade ever made it. The drift is invisible on any single
   *   frame, which is exactly why this fixture is parked one frame from a flip.
   * LOAD-BEARING: yes — the stub leaves the fright timer at 120.
   */
  it('freezes the wave clock while the ghosts are frightened, and counts only the fright down', () => {
    const state = buildState({
      modes: { waveIndex: 0, waveFrames: 419, frightenedFramesLeft: 120 },
    });

    const { state: next, events } = modeSystem.run(state, frameContext(), []);

    /* waveFrames is STILL 419: the frame was spent on the fright timer. */
    expect(next.modes).toEqual({ waveIndex: 0, waveFrames: 419, frightenedFramesLeft: 119 });
    expect(events).toEqual([]);
    expect(next.ghosts[GhostId.Blinky].reverseQueued).toBe(false);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: an edge on a counter reaching zero. One call from one frame
   *   before it states the whole rule.
   * MEASURES: that the frame on which the fright timer reaches zero emits
   *   exactly one frightenedEnded, is STILL a frozen frame for the wave clock,
   *   and reverses nobody.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4: repo tie-break 2 —
   *   "frightenedEnded is an edge: true on the single frame the timer reaches
   *   zero"; repo tie-break 1 — "the frame on which the timer falls from 1 to 0
   *   is therefore still a frozen frame; the clock resumes on the frame after
   *   it"; and "Reversal" — "Fright ending is not in the Dossier's list, so it
   *   does not reverse anybody."
   * CATCHES: three separate ships. A frightenedEnded that never fires leaves
   *   the siren playing the frightened loop for the rest of the level and the
   *   ghost-score ladder stuck at 1600. A wave clock that resumes on this frame
   *   rather than the next one flips the wave here — one frame early forever
   *   after. And a reversal queued when fright ends spins all four ghosts round
   *   the instant they stop being blue, which the arcade never does and which
   *   hands the player a free escape every single power pellet.
   * LOAD-BEARING: yes.
   */
  it('announces the end of fright on the frame the timer reaches zero, reversing nobody', () => {
    const state = buildState({ modes: { waveIndex: 0, waveFrames: 419, frightenedFramesLeft: 1 } });

    const { state: next, events } = modeSystem.run(state, frameContext(), []);

    expect(next.modes).toEqual({ waveIndex: 0, waveFrames: 419, frightenedFramesLeft: 0 });
    expect(events).toEqual([{ kind: 'frightenedEnded' }]);
    expect(next.ghosts[GhostId.Blinky].reverseQueued).toBe(false);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: a gate is a claim about four inputs producing no output;
   *   the cheapest honest statement of it is four direct calls.
   * MEASURES: that outside the playing phase the system returns the SAME state
   *   object — not a copy — and emits nothing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7.2, which gives READY! 120
   *   frames, the death pause 180 and the level-complete flash 120: they are
   *   pauses, and nothing about the world is simulated during them. The wave
   *   clock is part of the world, so 2 of the first scatter's 7 seconds must
   *   not be burned by the countdown that precedes the round.
   * CATCHES: a clock that runs during the freezes. The player watches the
   *   READY! banner while a third of the opening scatter drains away, and the
   *   death pause quietly eats fright time from the round that follows. The
   *   identity check is the second half: `runSystems` threads the state by
   *   reference so that a frame in which nothing happened returns the very
   *   object that went in, and a `{ ...state }` here would defeat every
   *   downstream `toBe` while changing no value anybody could assert on.
   * LOAD-BEARING: no — the stub returns `unchanged(state)` for every phase, so
   *   this passes before a line is written. A guard, and a deliberate one: it
   *   is the only test that can fail an implementation which advances the clock
   *   unconditionally, and the only one that pins the identity contract.
   */
  it('does not run the clock outside the playing phase, and returns the same state object', () => {
    expect.assertions(8);
    const frozen = [
      RoundPhase.Ready,
      RoundPhase.Dying,
      RoundPhase.LevelComplete,
      RoundPhase.GameOver,
    ];

    for (const phase of frozen) {
      /* One frame from a flip again, so an ungated implementation does not
         merely differ by one — it changes the mode and emits an event. */
      const state = buildState({
        phase,
        modes: { waveIndex: 0, waveFrames: 419, frightenedFramesLeft: 0 },
      });

      const { state: next, events } = modeSystem.run(state, frameContext(), []);

      expect(next).toBe(state);
      expect(events).toEqual([]);
    }
  });
});
