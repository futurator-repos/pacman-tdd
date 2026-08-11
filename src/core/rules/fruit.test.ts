import { describe, expect, it } from 'vitest';

import { NO_FRUIT, eatFruit, stepFruit, type FruitState } from './fruit.ts';
import { FruitKind } from './level-spec.ts';
import { levelSpec } from './level-table.ts';

/**
 * The bonus item.
 *
 * Every number here comes from docs/ARCADE-REFERENCE.md section 13.4: the two
 * appearances at 70 and 170 dots EATEN are the Dossier's, and the 570-frame
 * lifetime is a [repo convention] — the Dossier states 9 to 10 seconds and says
 * the exact figure is variable, so we take the 9.5-second midpoint rather than
 * spend a draw from the injected Rng and make two replays of the same input log
 * diverge.
 *
 * These tests drive `stepFruit` and `eatFruit` with TWO rows of the REAL level
 * table rather than with a hand-built spec, which is the opposite of what
 * mode-schedule.test.ts does and for a reason: the behaviour under test IS "the
 * bonus is whatever the level's own row says it is". Two rows are the minimum
 * that can say so — with level 1 alone, an implementation that hard-codes a
 * cherry and a hundred points is indistinguishable from a correct one, and the
 * real table does not help, because level 1's row IS a cherry worth a hundred.
 *
 * The count that drives the appearances is dots EATEN, climbing from 0 to 244,
 * and not dots remaining. Cruise Elroy uses the other one (section 5), so the
 * two counts sit a few files apart in the same codebase — which is exactly the
 * sort of pair that gets swapped, and exactly why 69/70 and 169/170 are asserted
 * on both sides.
 */

/** Level 1's row: a cherry worth 100. docs/ARCADE-REFERENCE.md section 3. */
const LEVEL_1 = levelSpec(1);

/** Level 5's row: an apple worth 700. Same section, a different row. */
const LEVEL_5 = levelSpec(5);

describe('stepFruit', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: A small state machine over a dot count. Driving it directly
   *   is the only way to state the trigger as a boundary — 69 against 70 — since
   *   through the pipeline the two frames are seventy pellets and several seconds
   *   apart and nothing distinguishes them but the count.
   * MEASURES: That nothing appears on the sixty-ninth dot; that on the seventieth
   *   the level's own fruit appears with a full 570-frame life; that the
   *   appearance is reported as an edge alongside the new state; and that on
   *   level 5 the same seventieth dot brings out level 5's fruit instead.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.4 (Dossier, "Bonus fruits"): the
   *   first bonus appears at 70 dots eaten. Its lifetime is 570 frames, 9.5 s at
   *   the 60 fps of section 1. Section 3 row 1 makes level 1's fruit a cherry and
   *   row 5 makes level 5's an apple.
   * CATCHES: A trigger written against dots REMAINING (the fruit would appear at
   *   174 eaten, near the end of the board, and the second would never appear at
   *   all), or an off-by-one that fires at 69 or 71. All three look identical in
   *   play until someone counts.
   *
   *   And a `stepFruit` that ignores the spec it was handed and puts out a cherry
   *   whatever the level. With level 1 as the only fixture that implementation
   *   passes every stepFruit test here — it was written and it did — and it ships
   *   a cherry on the board of a level whose row says key, which the player then
   *   eats for 5000 points or 100 depending on which half of the bug you meet.
   * LOAD-BEARING: yes — the stub reports no appearance and an empty board.
   */
  it('brings the level own fruit out on the seventieth dot eaten, and not on the sixty-ninth', () => {
    expect(stepFruit(NO_FRUIT, 69, LEVEL_1).appeared).toBe(null);

    const step = stepFruit(NO_FRUIT, 70, LEVEL_1);

    expect(step.appeared).toBe(FruitKind.Cherry);
    expect(step.fruit.onBoard).toBe(FruitKind.Cherry);
    expect(step.fruit.framesLeft).toBe(570); // 9.5 s
    expect(step.fruit.spawned).toBe(1);

    /* The same seventieth dot on a different row of the same table. The fruit is
       whatever the level says it is, and nothing here may be hard-coded. */
    const onLevel5 = stepFruit(NO_FRUIT, 70, LEVEL_5);

    expect(onLevel5.appeared).toBe(FruitKind.Apple);
    expect(onLevel5.fruit.onBoard).toBe(FruitKind.Apple);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The second appearance is 100 dots after the first, so through
   *   the pipeline this test would be a hundred pellets of setup for one
   *   assertion. Handed the state directly, it is three calls — and it can ask
   *   the question that matters, which is what happens on the dots BETWEEN and
   *   AFTER the two triggers.
   * MEASURES: That no bonus appears at 100 or 169 dots with one already spent,
   *   that the second appears at exactly 170, and that nothing appears again at
   *   171 or at 243 once both are spent.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.4: two appearances per level, at
   *   70 and 170 dots eaten, and no third — with 244 edible tiles on the board
   *   (section 8.1) a completed level offers exactly two bonuses.
   * CATCHES: A `dotsEaten >= 70` comparison with no counter behind it, which
   *   spawns a fresh fruit on every single dot from the seventieth onward. The
   *   player collects a hundred and seventy bonuses a level and the score becomes
   *   meaningless — and note that the 70-dot test above passes happily against
   *   that implementation.
   * LOAD-BEARING: yes — the stub reports no appearance at 170, and it also loses
   *   the `spawned` count on the frames where nothing happens.
   */
  it('brings the second fruit out on the hundred-and-seventieth dot, and never a third', () => {
    const oneSpent: FruitState = { onBoard: null, framesLeft: 0, spawned: 1 };

    expect(stepFruit(oneSpent, 100, LEVEL_1).appeared).toBe(null);
    expect(stepFruit(oneSpent, 100, LEVEL_1).fruit).toEqual(oneSpent);
    expect(stepFruit(oneSpent, 169, LEVEL_1).appeared).toBe(null);

    const second = stepFruit(oneSpent, 170, LEVEL_1);

    expect(second.appeared).toBe(FruitKind.Cherry);
    expect(second.fruit.spawned).toBe(2);

    const bothSpent: FruitState = { onBoard: null, framesLeft: 0, spawned: 2 };

    expect(stepFruit(bothSpent, 171, LEVEL_1).appeared).toBe(null);
    expect(stepFruit(bothSpent, 243, LEVEL_1).appeared).toBe(null);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A countdown of 570 frames, which is nine and a half seconds of
   *   real play. A unit folds it in a millisecond and can assert the exact frame
   *   the fruit leaves; an integration test would have to run the whole game for
   *   nine seconds to learn the same thing, and could not distinguish frame 569
   *   from frame 571.
   * MEASURES: The fruit is still on the board with one frame left after 569
   *   steps, vanishes on the 570th reporting itself expired, and reports nothing
   *   on the frame after that.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.4: a bonus stays on screen 9 to 10
   *   seconds; this codebase fixes it at the 9.5-second midpoint, 570 frames at
   *   the 60 fps of section 1. Expiry is an edge, on the same terms as
   *   `frightenedEnded` in section 4.
   * CATCHES: A fruit that never expires — it then sits on the board for the rest
   *   of the level and can be eaten again every time Pac-Man crosses that tile,
   *   which on the classic board is a corridor he uses constantly. Also the
   *   opposite bug, an expiry reported on every frame after the timer empties,
   *   which fires the sound effect sixty times a second.
   * LOAD-BEARING: yes (the stub never puts a fruit on the board at all).
   *
   * The fold below contains no assertion — see the same note in
   * ghost-combo.test.ts. A loop that asserts can pass by never running.
   */
  it('takes an uneaten fruit off the board on the last frame of its 570-frame life', () => {
    let state = stepFruit(NO_FRUIT, 70, LEVEL_1).fruit;

    /* 569 frames of waiting: one short of the full life. The dot count stays at
       100 throughout, which is past the first trigger and short of the second —
       the state of a player who has stopped eating. */
    for (let frame = 0; frame < 569; frame += 1) {
      state = stepFruit(state, 100, LEVEL_1).fruit;
    }

    expect(state.onBoard).toBe(FruitKind.Cherry);
    expect(state.framesLeft).toBe(1);

    const vanishes = stepFruit(state, 100, LEVEL_1);

    expect(vanishes.expired).toBe(FruitKind.Cherry);
    expect(vanishes.fruit.onBoard).toBe(null);
    expect(vanishes.fruit.framesLeft).toBe(0);
    expect(vanishes.fruit.spawned).toBe(1);

    /* An edge, not a level: the frame after reports nothing. */
    expect(stepFruit(vanishes.fruit, 100, LEVEL_1).expired).toBe(null);
  });
});

describe('eatFruit', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: The claim is "the value comes from the level's row", which is
   *   a statement about two levels at once. Two direct calls state it; reaching
   *   level 5 through the game to check the second would take five cleared boards.
   * MEASURES: That eating the bonus pays levelSpec(level).fruitPoints, names the
   *   kind eaten, clears the board, and — the easy one to lose — leaves the
   *   `spawned` count alone so the level's second bonus still arrives.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3, the Fruit and Points columns:
   *   row 1 is a cherry worth 100, row 5 an apple worth 700. Section 13.4 states
   *   that this table is the only one — there is deliberately no second table
   *   keyed by fruit kind.
   * CATCHES: A hard-coded 100, which pays a cherry's price for a level-13 key
   *   worth 5000 and makes every late level score like the first. Also a reset of
   *   `spawned`, which would give the player a bonus every hundred dots forever.
   * LOAD-BEARING: yes (the stub pays 0 and eats nothing).
   */
  it('pays the level own fruit points: a 100-point cherry at level 1, a 700-point apple at level 5', () => {
    const cherry: FruitState = { onBoard: FruitKind.Cherry, framesLeft: 400, spawned: 1 };
    const bite = eatFruit(cherry, LEVEL_1);

    expect(bite.eaten).toBe(FruitKind.Cherry);
    expect(bite.points).toBe(100);
    expect(bite.fruit.onBoard).toBe(null);
    expect(bite.fruit.framesLeft).toBe(0);
    expect(bite.fruit.spawned).toBe(1);

    const apple: FruitState = { onBoard: FruitKind.Apple, framesLeft: 12, spawned: 2 };
    const richer = eatFruit(apple, LEVEL_5);

    expect(richer.eaten).toBe(FruitKind.Apple);
    expect(richer.points).toBe(700);
    expect(richer.fruit.spawned).toBe(2);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A totality question. The fruit tile is an ordinary corridor
   *   tile that Pac-Man crosses dozens of times a level, almost always with
   *   nothing on it, so this is the COMMON case rather than an edge case — and it
   *   is what lets the caller ask unconditionally instead of guarding.
   * MEASURES: eatFruit on an empty board scores nothing and names nothing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.5 by analogy — collision is
   *   decided by tile occupancy, and an empty tile is occupied by nothing. There
   *   is no arcade fact to cite here; this is the codebase's totality contract,
   *   stated in fruit.ts.
   * CATCHES: Points awarded for crossing an empty fruit tile, which on the
   *   classic board would pay out several times a second. GUARD: the stub returns
   *   zero points and a null kind, so this test passes at RED. It pins nothing on
   *   its own and is kept because it documents the contract that removes a guard
   *   from every call site.
   * LOAD-BEARING: no (a do-nothing stub satisfies it).
   */
  it('scores nothing for crossing the fruit tile when no fruit is there', () => {
    const bite = eatFruit(NO_FRUIT, LEVEL_1);

    expect(bite.eaten).toBe(null);
    expect(bite.points).toBe(0);
    expect(bite.fruit).toEqual(NO_FRUIT);
  });
});
