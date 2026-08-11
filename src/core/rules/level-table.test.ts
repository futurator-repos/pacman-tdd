import { describe, expect, it } from 'vitest';

import { FruitKind, GlobalMode } from './level-spec.ts';
import { levelSpec } from './level-table.ts';

/**
 * The arcade's per-level difficulty table.
 *
 * EVERY number asserted in this file is transcribed from docs/ARCADE-REFERENCE.md
 * section 3, which in turn transcribes Appendix A of the Pac-Man Dossier. That
 * matters more here than anywhere else in the codebase: a table test whose
 * expectations were copied out of the table it is testing is a tautology that
 * will pass forever and protect nothing. Read a number in this file, open the
 * document, check it. That is the whole contract.
 *
 * Speeds are fractions of full speed exactly as the arcade states them — 0.8,
 * not 80 and not 205 sub-pixels per frame. The conversion is slice s03's job and
 * is tested there, so a failure here is always a TABLE failure.
 *
 * Durations are frame literals with the seconds in a comment. They are not
 * computed from FRAME_MS: an expectation produced by the same arithmetic the
 * implementation uses has stopped being an independent oracle.
 */
describe('levelSpec', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Sixteen fields of static data behind one pure lookup. There
   *   is nothing to integrate and nothing to generate — a property test would
   *   have to restate the table to know what to expect, which is no oracle at
   *   all. Four representative rows are asserted (1, 2, 5, 21) rather than all
   *   twenty-one, because those four are where the table actually STEPS.
   * MEASURES: Every scalar field of the level-1 row.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3, row 1 (Dossier Appendix A):
   *   Pac 80%, Pac-eating ~71%, ghosts 75%, ghosts in tunnel 40%, Elroy 1 at 20
   *   dots left / 80%, Elroy 2 at 10 dots left / 85%, frightened Pac 90% and
   *   ~79%, frightened ghosts 50%, fright 6 s = 360 frames, 5 flashes, cherry
   *   worth 100.
   * CATCHES: The single most likely table bug — a row transcribed one line out
   *   of the source, or percentages stored as 80 instead of 0.8. Either makes
   *   level 1 play like some other level, and nothing else in the suite would
   *   notice: the game would still run, still be beatable, and simply not be
   *   Pac-Man.
   * LOAD-BEARING: yes (the stub returns zeros for every number).
   */
  it('gives level 1 the arcade row: 80% pac-man, 75% ghosts, a 6-second fright and a 100-point cherry', () => {
    const spec = levelSpec(1);

    expect(spec.level).toBe(1);
    expect(spec.pacmanSpeed).toBe(0.8);
    expect(spec.pacmanDotSpeed).toBe(0.71);
    expect(spec.pacmanFrightSpeed).toBe(0.9);
    expect(spec.pacmanFrightDotSpeed).toBe(0.79);
    expect(spec.ghostSpeed).toBe(0.75);
    expect(spec.ghostTunnelSpeed).toBe(0.4);
    expect(spec.ghostFrightSpeed).toBe(0.5);
    expect(spec.elroy1DotsLeft).toBe(20);
    expect(spec.elroy1Speed).toBe(0.8);
    expect(spec.elroy2DotsLeft).toBe(10);
    expect(spec.elroy2Speed).toBe(0.85);
    expect(spec.frightenedFrames).toBe(360); // 6 s x 60
    expect(spec.frightenedFlashes).toBe(5);
    expect(spec.fruit).toBe(FruitKind.Cherry);
    expect(spec.fruitPoints).toBe(100);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Same shape and cost as the level-1 row. It exists separately
   *   because level 2 is the first STEP in the table: every speed column moves
   *   at once. A table that returned row 1 for everything would pass the level-1
   *   test perfectly.
   * MEASURES: Every scalar field of the level-2 row.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3, row 2: Pac 90%/~79%, ghosts
   *   85%, tunnel 45%, Elroy 30/90% and 15/95%, frightened 95%/~83%/55%, fright
   *   5 s = 300 frames, 5 flashes, strawberry worth 300.
   * CATCHES: An off-by-one index into the table — `LEVEL_TABLE[level]` instead
   *   of `[level - 1]` — which is invisible at level 1 if the array happens to
   *   start with a filler row, and shifts every level thereafter.
   * LOAD-BEARING: yes.
   */
  it('steps up at level 2: 90% pac-man, 85% ghosts, a 5-second fright and a 300-point strawberry', () => {
    const spec = levelSpec(2);

    expect(spec.level).toBe(2);
    expect(spec.pacmanSpeed).toBe(0.9);
    expect(spec.pacmanDotSpeed).toBe(0.79);
    expect(spec.pacmanFrightSpeed).toBe(0.95);
    expect(spec.pacmanFrightDotSpeed).toBe(0.83);
    expect(spec.ghostSpeed).toBe(0.85);
    expect(spec.ghostTunnelSpeed).toBe(0.45);
    expect(spec.ghostFrightSpeed).toBe(0.55);
    expect(spec.elroy1DotsLeft).toBe(30);
    expect(spec.elroy1Speed).toBe(0.9);
    expect(spec.elroy2DotsLeft).toBe(15);
    expect(spec.elroy2Speed).toBe(0.95);
    expect(spec.frightenedFrames).toBe(300); // 5 s x 60
    expect(spec.frightenedFlashes).toBe(5);
    expect(spec.fruit).toBe(FruitKind.Strawberry);
    expect(spec.fruitPoints).toBe(300);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The third of the four rows worth pinning by hand. Level 5 is
   *   where Pac-Man reaches 100% and the ghosts reach 95% — the last speed step
   *   the table ever takes — and where the fright collapses to two seconds.
   * MEASURES: Every scalar field of the level-5 row.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3, row 5: Pac 100%/~87%, ghosts
   *   95%, tunnel 50%, Elroy 40/100% and 20/105%, frightened 100%/~87%/60%,
   *   fright 2 s = 120 frames, 5 flashes, apple worth 700.
   * CATCHES: Elroy 2 stored as slower than the base ghost speed. 105% is the
   *   only figure in the whole table above 100%, so it is the one a transcriber
   *   "corrects" — and a Blinky who never outruns his brothers stops being
   *   frightening at exactly the level the original starts to bite.
   * LOAD-BEARING: yes.
   */
  it('reaches full speed at level 5: 100% pac-man, 95% ghosts, a 2-second fright and a 700-point apple', () => {
    const spec = levelSpec(5);

    expect(spec.level).toBe(5);
    expect(spec.pacmanSpeed).toBe(1);
    expect(spec.pacmanDotSpeed).toBe(0.87);
    expect(spec.pacmanFrightSpeed).toBe(1);
    expect(spec.pacmanFrightDotSpeed).toBe(0.87);
    expect(spec.ghostSpeed).toBe(0.95);
    expect(spec.ghostTunnelSpeed).toBe(0.5);
    expect(spec.ghostFrightSpeed).toBe(0.6);
    expect(spec.elroy1DotsLeft).toBe(40);
    expect(spec.elroy1Speed).toBe(1);
    expect(spec.elroy2DotsLeft).toBe(20);
    expect(spec.elroy2Speed).toBe(1.05);
    expect(spec.frightenedFrames).toBe(120); // 2 s x 60
    expect(spec.frightenedFlashes).toBe(5);
    expect(spec.fruit).toBe(FruitKind.Apple);
    expect(spec.fruitPoints).toBe(700);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A table lookup plus both clamps, in one place, because the
   *   clamp is the reason this function exists at all. Asserting level 21 field
   *   by field and then comparing level 256 to it means the far end of the
   *   domain is checked without transcribing the row twice — and the whole-record
   *   comparison catches a field the by-hand list forgot.
   * MEASURES: The level-21 row; that levelSpec(256) is that row with only the
   *   `level` field differing; that levelSpec(0) and levelSpec(-3) are level 1's
   *   row, likewise differing only in `level`.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3: levels 21 and above all use the
   *   level-21 row — Pac drops BACK to 90%/~79% while the ghosts stay at 95%,
   *   Elroy 120/100% and 60/105%, no fright, no flashes, a 5000-point key. Both
   *   clamps are repo decisions rather than arcade facts, and each has its own
   *   written source: ARCHITECTURE.md's s04 contract states "levelSpec(0) and a
   *   negative level clamp to level 1 rather than throwing", and TEST-PLAN.md's
   *   entry for this test states that levelSpec(256) "deep-equals levelSpec(21)
   *   except for its level field" — which is where the convention that `level`
   *   reports the level ASKED for is recorded.
   * CATCHES: An unclamped index returning undefined at level 22 — which under
   *   noUncheckedIndexedAccess crashes the game for anyone good enough to reach
   *   it, the classic bug nobody finds because nobody plays that far in testing.
   *   And, at the other end, a `startGame` that asks for level 0 taking the same
   *   crash before the first frame.
   * LOAD-BEARING: yes.
   */
  it('uses level 21 for every level above it, and level 1 for level 0 and below', () => {
    const twentyOne = levelSpec(21);

    expect(twentyOne.level).toBe(21);
    expect(twentyOne.pacmanSpeed).toBe(0.9); // slower than the ghosts, forever
    expect(twentyOne.pacmanDotSpeed).toBe(0.79);
    expect(twentyOne.ghostSpeed).toBe(0.95);
    expect(twentyOne.ghostTunnelSpeed).toBe(0.5);
    expect(twentyOne.elroy1DotsLeft).toBe(120);
    expect(twentyOne.elroy1Speed).toBe(1);
    expect(twentyOne.elroy2DotsLeft).toBe(60);
    expect(twentyOne.elroy2Speed).toBe(1.05);
    expect(twentyOne.frightenedFrames).toBe(0);
    expect(twentyOne.frightenedFlashes).toBe(0);
    expect(twentyOne.fruit).toBe(FruitKind.Key);
    expect(twentyOne.fruitPoints).toBe(5000);

    /* The upper clamp, as a whole-record comparison so a field the list above
       forgot is still covered. Spreading a record is fine; spreading a string
       is what the lint rule forbids. */
    expect(levelSpec(256)).toEqual({ ...twentyOne, level: 256 });
    expect(levelSpec(22)).toEqual({ ...twentyOne, level: 22 });

    /* The lower clamp. Anchored on a real number as well as the record compare,
       so this cannot pass merely because both calls returned the same thing. */
    const one = levelSpec(1);
    expect(levelSpec(0)).toEqual({ ...one, level: 0 });
    expect(levelSpec(-3)).toEqual({ ...one, level: -3 });
    expect(levelSpec(0).ghostSpeed).toBe(0.75);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: One field across a boundary — levels 18, 19 and 20 — which is
   *   as cheap as a test gets. It deliberately stops at the table: what a
   *   zero-length fright DOES when a power pellet is eaten is an integration
   *   test in another slice, so a failure here always means the table, and a
   *   failure there always means the wiring.
   * MEASURES: frightenedFrames is above zero at level 18 and exactly zero at 19
   *   and 20; and that level 17's documented zero is not an accident either.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3: fright time is 1 s at level 18,
   *   and the dashes at 19, 20 and 21+ mean no fright at all. Level 17 is also a
   *   dash — the curve is genuinely non-monotonic there, and the document says
   *   so explicitly.
   * CATCHES: A zero read as "no data" and defaulted to a level-1 fright. Level
   *   19 would become EASIER than level 18, inverting the difficulty curve at
   *   exactly the point the original made it hardest.
   * LOAD-BEARING: yes, but only partly — the stub returns 0 for every level, so
   *   the three `toBe(0)` assertions pass against it. The level-18 assertion is
   *   what makes this test honest, and it is why "fright is zero" alone would
   *   have been a worthless test. Recorded rather than hidden.
   */
  it('has no fright at all from level 19 on, and none at level 17 either, while level 18 still has one second', () => {
    expect(levelSpec(18).frightenedFrames).toBe(60); // 1 s x 60
    expect(levelSpec(18).frightenedFlashes).toBe(3);

    expect(levelSpec(17).frightenedFrames).toBe(0);
    expect(levelSpec(19).frightenedFrames).toBe(0);
    expect(levelSpec(20).frightenedFrames).toBe(0);

    /* A power pellet at level 19 still scores and still reverses the ghosts.
       Only the blue period is gone — so the flash count goes with it. */
    expect(levelSpec(19).frightenedFlashes).toBe(0);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Table data compared in a single whole-array assertion, which
   *   is the only form that covers the FINAL entry. A spot-check of "the third
   *   wave is scatter" would miss precisely the case that matters — the endless
   *   chase with no duration.
   * MEASURES: levelSpec(1).waves is the eight-entry level-1 schedule, in order,
   *   with the last entry's durationFrames null.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4, level-1 table: scatter 7 s,
   *   chase 20 s, scatter 7 s, chase 20 s, scatter 5 s, chase 20 s, scatter 5 s,
   *   then chase forever. At 60 frames per second: 420, 1200, 420, 1200, 300,
   *   1200, 300, null.
   * CATCHES: A missing final entry, so the schedule runs off the end of the
   *   array and either throws or wraps back round to scatter. The ghosts would
   *   wander to their corners forever in the late game and the level would
   *   become unloseable — a bug that only shows up after 80 seconds of play.
   * LOAD-BEARING: yes (the stub's waves are []).
   */
  it('runs level 1 as scatter 7s, chase 20s, scatter 7s, chase 20s, scatter 5s, chase 20s, scatter 5s, then chase forever', () => {
    expect(levelSpec(1).waves).toEqual([
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
});
