import { describe, expect, it } from 'vitest';

import { FruitKind, GlobalMode, type LevelSpec, type ModePhase } from './level-spec.ts';
import { advanceModes, currentMode, wavesForLevel, type ModeState } from './mode-schedule.ts';

/**
 * The scatter/chase wave clock.
 *
 * All four ghosts share one timer. It counts frames, it flips between scatter
 * and chase at documented boundaries, and — the rule that is easiest to omit
 * and hardest to notice — it STOPS DEAD while the ghosts are frightened.
 * docs/ARCADE-REFERENCE.md section 4 quotes the Dossier directly:
 *
 *   "If the ghosts enter frightened mode, the scatter/chase timer is paused.
 *    When time runs out, they return to the mode they were in before being
 *    frightened and the scatter/chase timer resumes."
 *
 * The clock tests below drive a HAND-BUILT spec with waves three and five
 * frames long, not the real level table. Two reasons, both about failure
 * messages: a unit should show its own situation rather than send you to
 * another file to find out what 420 meant, and stepping a 420-frame wave to its
 * boundary would make the test about a loop instead of about a rule. The real
 * durations are pinned once, in level-table.test.ts, where they belong.
 */

/**
 * A LevelSpec carrying nothing but a wave schedule.
 *
 * Every other field is deliberately zero, and that is itself a specification:
 * the wave clock must not read the speeds, the fruit or the Elroy thresholds.
 * If a GREEN implementation ever starts consulting them, these zeros are what
 * it will consult, and the resulting failure will be immediate rather than
 * subtle.
 */
function specWithWaves(waves: readonly ModePhase[]): LevelSpec {
  return {
    level: 1,
    pacmanSpeed: 0,
    pacmanDotSpeed: 0,
    pacmanFrightSpeed: 0,
    pacmanFrightDotSpeed: 0,
    ghostSpeed: 0,
    ghostTunnelSpeed: 0,
    ghostFrightSpeed: 0,
    elroy1DotsLeft: 0,
    elroy1Speed: 0,
    elroy2DotsLeft: 0,
    elroy2Speed: 0,
    frightenedFrames: 0,
    frightenedFlashes: 0,
    fruit: FruitKind.Cherry,
    fruitPoints: 0,
    waves,
  };
}

/** scatter 3 frames, chase 5 frames, scatter 2 frames, then chase forever. */
const TINY_SCHEDULE: readonly ModePhase[] = [
  { mode: GlobalMode.Scatter, durationFrames: 3 },
  { mode: GlobalMode.Chase, durationFrames: 5 },
  { mode: GlobalMode.Scatter, durationFrames: 2 },
  { mode: GlobalMode.Chase, durationFrames: null },
];

/** A single wave long enough that nothing flips during these tests. */
const ONE_LONG_WAVE: readonly ModePhase[] = [{ mode: GlobalMode.Scatter, durationFrames: 600 }];

/**
 * Fold the clock forward, with NO assertion inside the loop.
 *
 * That is deliberate. An assertion inside a loop can pass vacuously when the
 * loop body never runs, which is why the house style demands expect.assertions
 * around such loops. Keeping the loop assertion-free removes the hazard
 * altogether: the test asserts once, afterwards, on the value the fold produced.
 */
function runFrames(start: ModeState, spec: LevelSpec, frames: number): ModeState {
  let modes = start;
  for (let i = 0; i < frames; i += 1) {
    modes = advanceModes(modes, spec).modes;
  }
  return modes;
}

describe('wavesForLevel', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Static table data, compared whole. Level 1 is the only level
   *   that uses its own table, so "the first and last level that uses it" is one
   *   assertion here rather than two.
   * MEASURES: The complete eight-entry schedule for level 1, read through
   *   wavesForLevel itself.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4, "Level 1": scatter 7 s, chase
   *   20 s, scatter 7 s, chase 20 s, scatter 5 s, chase 20 s, scatter 5 s, chase
   *   forever. At 60 frames per second: 420, 1200, 420, 1200, 300, 1200, 300,
   *   null.
   * CATCHES: A lookup written `level < 2 ? LEVELS_2_TO_4 : ...`, or any boundary
   *   that starts the 2-to-4 table one level early. Level 1 would get a
   *   1033-second sixth wave and the very first board would stop scattering
   *   after ninety seconds. level-table.test.ts pins levelSpec(1).waves, which
   *   only covers this if levelSpec delegates here — nothing specifies that it
   *   must, so the level-1 branch of THIS function needs its own assertion.
   * LOAD-BEARING: yes (the stub returns []).
   */
  it('runs level 1 with two 7-second scatters and a 20-second sixth wave', () => {
    expect(wavesForLevel(1)).toEqual([
      { mode: GlobalMode.Scatter, durationFrames: 420 }, // 7 s
      { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
      { mode: GlobalMode.Scatter, durationFrames: 420 }, // 7 s
      { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
      { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
      { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
      { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
      { mode: GlobalMode.Chase, durationFrames: null }, // and never again
    ]);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Static table data, compared whole. Two levels are asserted
   *   per table — the first and last level that uses it — because the interesting
   *   defect is a boundary written as `level < 5` instead of `level <= 4`, and a
   *   single sample per table cannot see it.
   * MEASURES: The complete eight-entry schedule for levels 2 and 4.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4, "Levels 2 to 4": scatter 7 s,
   *   chase 20 s, scatter 7 s, chase 20 s, scatter 5 s, chase 1033 s, scatter
   *   1/60 s, chase forever. At 60 frames per second: 420, 1200, 420, 1200, 300,
   *   61980, 1, null.
   * CATCHES: The 1033-second chase silently transcribed as another 20-second one.
   *   Levels 2 to 4 would keep cycling scatter periods for the whole level
   *   instead of settling into a seventeen-minute hunt — playable, plausible,
   *   and not the game.
   * LOAD-BEARING: yes (the stub returns []).
   */
  it('runs levels 2 to 4 with a 1033-second sixth wave followed by a single frame of scatter', () => {
    const expected: readonly ModePhase[] = [
      { mode: GlobalMode.Scatter, durationFrames: 420 }, // 7 s
      { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
      { mode: GlobalMode.Scatter, durationFrames: 420 }, // 7 s
      { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
      { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
      { mode: GlobalMode.Chase, durationFrames: 61980 }, // 1033 s
      { mode: GlobalMode.Scatter, durationFrames: 1 }, // 1/60 s — one frame
      { mode: GlobalMode.Chase, durationFrames: null },
    ];

    expect(wavesForLevel(2)).toEqual(expected);
    expect(wavesForLevel(4)).toEqual(expected);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: As above. Level 5 is where the table changes for the last
   *   time, and level 21 is the highest row, so asserting both proves the
   *   lookup is "5 and up" rather than "exactly 5".
   * MEASURES: The complete eight-entry schedule for levels 5 and 21.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4, "Levels 5 and up": the first two
   *   scatter periods shorten from 7 s to 5 s and the sixth wave lengthens from
   *   1033 s to 1037 s. At 60 frames per second: 300, 1200, 300, 1200, 300,
   *   62220, 1, null.
   * CATCHES: Levels 5+ served the level-2 table. The difference is four seconds
   *   of scatter in the opening minute — enough to change every ghost's position
   *   at the moment the player takes the first energizer, and far too small for
   *   anyone to spot by eye.
   * LOAD-BEARING: yes.
   */
  it('shortens the opening scatters to 5 seconds and stretches the sixth wave to 1037 seconds from level 5 on', () => {
    const expected: readonly ModePhase[] = [
      { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
      { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
      { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
      { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
      { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
      { mode: GlobalMode.Chase, durationFrames: 62220 }, // 1037 s
      { mode: GlobalMode.Scatter, durationFrames: 1 }, // 1/60 s — one frame
      { mode: GlobalMode.Chase, durationFrames: null },
    ];

    expect(wavesForLevel(5)).toEqual(expected);
    expect(wavesForLevel(21)).toEqual(expected);
  });
});

describe('currentMode', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: A pure lookup with one interesting edge — an index past the
   *   end of the array. Four examples cover the whole domain; there is nothing
   *   for a heavier test to add.
   * MEASURES: That the mode is read from the wave the clock currently stands on,
   *   and that an index beyond the schedule reports the final endless mode
   *   rather than undefined.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4: the schedule ends in a chase
   *   that never ends, so "past the end" is not a state the game can be in —
   *   it must resolve to that final chase.
   * CATCHES: `spec.waves[modes.waveIndex]` handed straight back. Under
   *   noUncheckedIndexedAccess that is `ModePhase | undefined`, and the first
   *   thing to touch `.mode` on it crashes — at whatever moment the last wave
   *   happens to expire, which is minutes into a level and nowhere near the code
   *   that caused it.
   * LOAD-BEARING: yes — with one honest caveat. The stub returns Scatter, so the
   *   first assertion passes against it. The three Chase assertions are what
   *   make the test bite, and the Scatter case is kept because a currentMode
   *   that answered Chase to everything must also fail.
   */
  it('reads the mode from the current wave, and answers the final endless chase past the end of the schedule', () => {
    const spec = specWithWaves(TINY_SCHEDULE);
    const at = (waveIndex: number): ModeState => ({
      waveIndex,
      waveFrames: 0,
      frightenedFramesLeft: 0,
    });

    expect(currentMode(at(0), spec)).toBe(GlobalMode.Scatter);
    expect(currentMode(at(1), spec)).toBe(GlobalMode.Chase);
    expect(currentMode(at(3), spec)).toBe(GlobalMode.Chase);
    expect(currentMode(at(99), spec)).toBe(GlobalMode.Chase);
  });
});

describe('advanceModes', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: An EDGE, and edges are where level-versus-edge confusion
   *   lives. Only a frame-by-frame unit can distinguish the two: it steps the
   *   clock across the boundary at N-1, N and N+1 and asserts all three. An
   *   integration test through the mode system would report "the ghosts
   *   reversed" without being able to say how often.
   * MEASURES: reversalRequired is false on the frame before a wave flip, true on
   *   the flip frame itself, and false again on the frame after; and that the
   *   flip moves to the next wave with its frame count reset to zero.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4, quoting the Dossier: "Ghosts are
   *   forced to reverse direction by the system anytime the mode changes from:
   *   chase-to-scatter, chase-to-frightened, scatter-to-chase, and
   *   scatter-to-frightened." Once, at the transition. The repo convention that
   *   a wave flips when its frames REACH its duration (a 3-frame wave is flipped
   *   by the 3rd advance) is stated in the same section.
   * CATCHES: reversalRequired reported as a level rather than an edge. Every
   *   ghost would reverse on every frame of the new mode and they would vibrate
   *   on the spot — dramatic on screen, but the arithmetic is "nearly right" and
   *   nothing else in the suite would catch it.
   * LOAD-BEARING: yes.
   */
  it('requires a reversal on exactly the frame a wave changes, and on neither the frame before nor the frame after', () => {
    const spec = specWithWaves(TINY_SCHEDULE); // first wave: scatter, 3 frames

    /* Two frames already spent in a three-frame wave: the next advance is the
       last frame of the wave, the one after it flips. */
    const beforeFlip = advanceModes({ waveIndex: 0, waveFrames: 1, frightenedFramesLeft: 0 }, spec);
    expect(beforeFlip.reversalRequired).toBe(false);
    expect(beforeFlip.modes).toEqual({ waveIndex: 0, waveFrames: 2, frightenedFramesLeft: 0 });

    const onFlip = advanceModes(beforeFlip.modes, spec);
    expect(onFlip.reversalRequired).toBe(true);
    expect(onFlip.modes).toEqual({ waveIndex: 1, waveFrames: 0, frightenedFramesLeft: 0 });
    expect(currentMode(onFlip.modes, spec)).toBe(GlobalMode.Chase);

    const afterFlip = advanceModes(onFlip.modes, spec);
    expect(afterFlip.reversalRequired).toBe(false);
    expect(afterFlip.modes).toEqual({ waveIndex: 1, waveFrames: 1, frightenedFramesLeft: 0 });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The one wave the other tests never reach — the final entry,
   *   whose durationFrames is null. Only a unit that sits ON that wave and keeps
   *   stepping can see it; every test above stops at wave 0 or 1.
   * MEASURES: Fifty consecutive advances while parked on the endless chase leave
   *   the wave index alone, ask for no reversal on any of the fifty frames, and
   *   simply keep counting frames.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4: "There are four scatter periods;
   *   after the fourth, the ghosts remain in chase mode permanently", and the
   *   repo convention in the same section that "forever" is `durationFrames:
   *   null` rather than a huge number.
   * CATCHES: `durationFrames ?? 0` — the null read as a zero-length wave. The
   *   clock would flip on every single frame of the final chase, so
   *   reversalRequired would be true sixty times a second and every ghost would
   *   vibrate on the spot for the rest of the level. That is the exact bug the
   *   reversal test above says it guards against, and that test cannot see it:
   *   it never reaches a wave with a null duration.
   * LOAD-BEARING: yes. The fifty falses pass against the stub — a do-nothing
   *   function reports false forever — so the state assertion is the half that
   *   bites: the stub answers waveIndex 0, waveFrames 0.
   */
  it('never flips or reverses while parked on the final endless chase', () => {
    const spec = specWithWaves(TINY_SCHEDULE); // wave 3 is chase, durationFrames null
    const endless = { waveIndex: 3, waveFrames: 0, frightenedFramesLeft: 0 };

    const reversals: boolean[] = [];
    let modes: ModeState = endless;
    for (let i = 0; i < 50; i += 1) {
      const step = advanceModes(modes, spec);
      reversals.push(step.reversalRequired);
      modes = step.modes;
    }

    expect(modes).toEqual({ waveIndex: 3, waveFrames: 50, frightenedFramesLeft: 0 });
    expect(reversals).toEqual(Array.from({ length: 50 }, () => false));
    expect(currentMode(modes, spec)).toBe(GlobalMode.Chase);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Two behaviours that MUST be asserted together. "The clock does
   *   not advance while frightened" on its own would pass against a clock that
   *   never advances at all — the classic negative-only assertion that specifies
   *   nothing. One unit, three stretches of frames, one honest claim.
   * MEASURES: 10 frames with no fright advance waveFrames by exactly 10; 10
   *   frames with the fright timer running leave waveFrames untouched while the
   *   fright timer counts down by exactly 10; 10 more frames after fright ends
   *   resume from where the clock stopped.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4, quoting the Dossier: "If the
   *   ghosts enter frightened mode, the scatter/chase timer is paused... and the
   *   scatter/chase timer resumes."
   * CATCHES: Fright running alongside the schedule. Every power pellet would
   *   silently eat several seconds of the player's scatter time, so the late
   *   waves arrive early — a cumulative drift of exactly the sort no
   *   single-frame test can see, and one that makes the game harder in a way
   *   that feels like bad luck rather than like a bug.
   * LOAD-BEARING: yes. Note which half does the work: the stub returns a zeroed
   *   state, so it fails BOTH halves here, but an implementation that simply
   *   never advanced would fail only the first. That is the half to read first
   *   when this test goes red.
   */
  it('advances the wave clock during normal play, freezes it completely while frightened, then resumes where it stopped', () => {
    const spec = specWithWaves(ONE_LONG_WAVE);

    const played = runFrames({ waveIndex: 0, waveFrames: 5, frightenedFramesLeft: 0 }, spec, 10);
    expect(played).toEqual({ waveIndex: 0, waveFrames: 15, frightenedFramesLeft: 0 });

    const frightened = runFrames(
      { waveIndex: 0, waveFrames: 15, frightenedFramesLeft: 200 },
      spec,
      10,
    );
    expect(frightened).toEqual({ waveIndex: 0, waveFrames: 15, frightenedFramesLeft: 190 });

    /* Ten more frames still under fright: the freeze is not a one-off. */
    const stillFrightened = runFrames(frightened, spec, 10);
    expect(stillFrightened).toEqual({ waveIndex: 0, waveFrames: 15, frightenedFramesLeft: 180 });

    const afterFright = runFrames(
      { waveIndex: 0, waveFrames: 15, frightenedFramesLeft: 0 },
      spec,
      10,
    );
    expect(afterFright).toEqual({ waveIndex: 0, waveFrames: 25, frightenedFramesLeft: 0 });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The other edge in this module, and the one every downstream
   *   consumer depends on — the siren, the ghost-score ladder and the ghost speed
   *   row all listen for it. Stepping past zero for several frames in a single
   *   unit is the cheapest possible proof that the edge does not repeat.
   * MEASURES: The advance that takes the timer from 1 to 0 reports frightenedEnded
   *   true; five further advances report it false every time; the ending frame is
   *   still a frozen frame for the wave clock, and it does not ask for a reversal.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4: fright has a definite end and
   *   fright ending is NOT in the Dossier's list of reversal triggers, so nobody
   *   turns around. The repo conventions in the same section fix the two
   *   tie-breaks the Dossier leaves open: the clock advances on a frame only if
   *   the fright timer was already zero at the START of it, so the 1-to-0 frame
   *   is the last frozen one; and frightenedEnded is an edge, not a level.
   * CATCHES: The event emitted on every frame while the timer sits at zero. The
   *   siren would restart sixty times a second, the ghost combo ladder would
   *   reset continuously, and the audio idempotence test in a different area
   *   would fail with a cause nobody could trace back to here.
   * LOAD-BEARING: yes. The five "and never again" assertions pass against the
   *   stub — a do-nothing function reports false forever, which is what they
   *   demand. The single true is what makes the test load-bearing, and this is
   *   the clearest example in the slice of why one assertion cannot be judged in
   *   isolation.
   */
  it('reports frightened ended on the single frame the timer reaches zero, freezing that frame too, and never again', () => {
    const spec = specWithWaves(ONE_LONG_WAVE);

    const ending = advanceModes({ waveIndex: 0, waveFrames: 7, frightenedFramesLeft: 1 }, spec);
    expect(ending.frightenedEnded).toBe(true);
    expect(ending.reversalRequired).toBe(false); // fright ending reverses nobody
    expect(ending.modes).toEqual({ waveIndex: 0, waveFrames: 7, frightenedFramesLeft: 0 });

    /* Five more frames, collected without asserting inside the loop. */
    const laterEdges: boolean[] = [];
    let modes = ending.modes;
    for (let i = 0; i < 5; i += 1) {
      const step = advanceModes(modes, spec);
      laterEdges.push(step.frightenedEnded);
      modes = step.modes;
    }

    expect(laterEdges).toEqual([false, false, false, false, false]);
    /* And the clock really did resume: five frames ran after the frozen one. */
    expect(modes).toEqual({ waveIndex: 0, waveFrames: 12, frightenedFramesLeft: 0 });
  });
});
