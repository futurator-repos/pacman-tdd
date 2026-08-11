import { describe, expect, it } from 'vitest';

import { type Tile, centreOf } from '../../geometry/tile.ts';
import { ARCADE_MAZE } from '../../maze/arcade-maze.ts';
import { type PelletField, createPelletField, eatAt } from '../../maze/pellets.ts';
import { FruitKind } from '../../rules/level-spec.ts';
import { levelSpec } from '../../rules/level-table.ts';
import { type StatePatch, buildState } from '../../testing/state-builder.ts';
import { RoundPhase } from '../game-phase.ts';

import { fruitSystem } from './fruit-system.ts';
import { frameContext } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The bonus fruit is the only thing in the game that appears out of nowhere,
 * sits there, and then leaves on its own. Everything else on the board is
 * either eaten or is chasing you.
 *
 * The RULE — appear on the 70th and 170th dot, live 570 frames, be worth what
 * the level's row says — is `src/core/rules/fruit.ts`, and it is already green
 * and tested against docs/ARCADE-REFERENCE.md section 13.4. This file is about
 * the ADAPTER, and an adapter has its own, quite different, ways of being
 * wrong. All three of them are silent:
 *
 *   1. **The wrong number reaches the rule.** `PelletField` carries both a
 *      count of what has been EATEN and, via `remaining`, a count of what is
 *      left, and Cruise Elroy in the same codebase counts the other way. Hand
 *      `stepFruit` the wrong one and the fruit turns up at the 74th dot from
 *      the end instead of the 70th from the start — which still looks like a
 *      fruit appearing, just not when the arcade puts it there. Every fixture
 *      here is built by actually eating dots off the real board, so eaten 70
 *      means remaining 174 and the two counts can never be confused for one
 *      another.
 *   2. **The eat fires on the wrong tile.** Pac-Man's spawn shares a COLUMN
 *      with the fruit tile and the corridor at (6,17) shares its ROW, so a
 *      comparison that has forgotten one axis eats the fruit from across the
 *      maze.
 *   3. **The value is hard-coded.** A cherry is 100 points at level 1 and
 *      nowhere else. Two tests eat a fruit at two different levels for exactly
 *      this reason: a constant that satisfies one of them fails the other.
 *
 * The system runs tenth, after both collision passes, so the dot count it reads
 * already includes the dot eaten this frame — which is what lets the seventieth
 * dot and the fruit that it earns happen on the same frame.
 */
describe('fruitSystem', () => {
  /**
   * The board as it stands after `dots` dots have been eaten, food and count
   * together.
   *
   * Worth the four lines rather than patching `pellets.eaten` to 70 and leaving
   * 244 dots lying on the board. That shortcut builds a world that cannot
   * occur, and — far worse here — it makes `eaten` and `remaining` 70 and 244
   * instead of 70 and 174, so an implementation that reads the wrong one of the
   * two would spawn nothing and the test would still be red for a reason nobody
   * could diagnose. Eating real dots off the real maze keeps the two counts
   * genuinely different and genuinely consistent.
   */
  const boardAfterEating = (dots: number): PelletField =>
    ARCADE_MAZE.pelletTiles
      .slice(0, dots)
      .reduce((field, tile) => eatAt(field, tile), createPelletField(ARCADE_MAZE));

  /**
   * A state patch standing Pac-Man on the CENTRE of a tile.
   *
   * The centre rather than the corner, because that is where `spawnPacman`
   * leaves him and where every turn in the game is decided — a fixture half a
   * tile out of phase would be testing a position the game never produces.
   */
  const standingOn = (tile: Tile): StatePatch => ({
    pacman: { actor: { position: centreOf(tile) } },
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: one system, one hand-built state, one outcome. Reaching the
   *   seventieth dot through the real pipeline would mean simulating some
   *   hundreds of frames of movement to assert a spawn, and would fail for any
   *   of a dozen unrelated reasons.
   * MEASURES: that the seventieth dot eaten puts the level's bonus on the
   *   board, with its full lifetime and the level's first of two bonuses spent.
   * ORACLE: docs/ARCADE-REFERENCE.md 13.4 "The bonus fruit: 70 and 170 dots,
   *   then 9 to 10 seconds" — first appearance at 70 dots EATEN, and the repo
   *   convention of a fixed 570 frames (9.5 s at the 60 fps of section 1).
   *   Section 3 "Per-level table", row 1: the level 1 fruit is a cherry.
   * CATCHES: a fruit that never appears — the player completes a level having
   *   been denied both bonuses and 200 points — or one triggered off the wrong
   *   count, which puts it out at the 74th dot from the end of the board.
   * LOAD-BEARING: yes — the stub leaves `fruit` untouched and emits nothing.
   */
  it('puts the level one cherry on the board on the seventieth dot eaten, and announces it', () => {
    const state = buildState({
      pellets: boardAfterEating(70),
      fruit: { onBoard: null, framesLeft: 0, spawned: 0 },
    });

    const { state: next, events } = fruitSystem.run(state, frameContext(), []);

    expect(next.fruit).toEqual({ onBoard: FruitKind.Cherry, framesLeft: 570, spawned: 1 });
    /* The event, not the state, is what the eat-fruit stinger listens for: a
       fruit is a thing that HAPPENED, and state cannot say "happened". */
    expect(events).toEqual([{ kind: 'fruitAppeared', fruit: FruitKind.Cherry }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: same reason, and more so — arriving at the 170th dot honestly
   *   would mean playing two thirds of a level first.
   * MEASURES: that the second bonus of the level arrives at 170 dots, and that
   *   what arrives is the CURRENT level's item.
   * ORACLE: docs/ARCADE-REFERENCE.md 13.4, second appearance at 170 dots eaten;
   *   section 3 "Per-level table", row 5 — level 5's fruit is the apple.
   * CATCHES: two bugs at once. A system that only ever spawns the first bonus
   *   halves the fruit score of every level; and a system that names the fruit
   *   from anywhere other than the level spec draws a cherry on level 5, where
   *   the player is owed an apple worth seven times as much.
   * LOAD-BEARING: yes.
   */
  it('brings out the second bonus at a hundred and seventy dots, as the LEVEL says, not as a cherry', () => {
    const state = buildState({
      level: 5,
      pellets: boardAfterEating(170),
      fruit: { onBoard: null, framesLeft: 0, spawned: 1 },
    });

    const { state: next, events } = fruitSystem.run(
      state,
      frameContext({ spec: levelSpec(5) }),
      [],
    );

    expect(next.fruit).toEqual({ onBoard: FruitKind.Apple, framesLeft: 570, spawned: 2 });
    expect(events).toEqual([{ kind: 'fruitAppeared', fruit: FruitKind.Apple }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: a countdown of one frame is arithmetic; the cheapest test
   *   that can see it is one frame of one system.
   * MEASURES: that a bonus already on the board loses exactly one frame of its
   *   life per tick, and that an ordinary frame is silent.
   * ORACLE: docs/ARCADE-REFERENCE.md 13.4 — the item stays for a bounded time
   *   (570 frames here) and section 1 makes one tick one frame, so 570 becomes
   *   569 and nothing else.
   * CATCHES: a system that calls the rule but throws its result away, leaving a
   *   fruit parked on the board for the rest of the level; and the opposite, a
   *   spurious event every frame, which would machine-gun the fruit stinger for
   *   nine and a half seconds.
   * LOAD-BEARING: yes.
   */
  it('spends one frame per tick of the life of a bonus already on the board, and says nothing', () => {
    const state = buildState({
      level: 2,
      pellets: boardAfterEating(90),
      fruit: { onBoard: FruitKind.Strawberry, framesLeft: 570, spawned: 1 },
    });

    const { state: next, events } = fruitSystem.run(
      state,
      frameContext({ spec: levelSpec(2) }),
      [],
    );

    expect(next.fruit).toEqual({ onBoard: FruitKind.Strawberry, framesLeft: 569, spawned: 1 });
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the expiry is the last frame of a counter. Running 570 real
   *   frames to reach it would test the loop, not the edge.
   * MEASURES: that the frame the counter reaches zero clears the board and
   *   reports the expiry once — and that the level's tally of bonuses SPENT is
   *   carried through rather than reset.
   * ORACLE: docs/ARCADE-REFERENCE.md 13.4 — expiry is an edge reported on the
   *   single frame the counter reaches zero, and the bonus appears twice per
   *   level and never a third time.
   * CATCHES: the reset. If an expired bonus gave back its slot, the counter
   *   would be due again and the board would grow a fresh strawberry every
   *   hundred dots — an endless supply of 300-point items the arcade never
   *   offers, which is the single most valuable bug a player could be handed.
   * LOAD-BEARING: yes.
   */
  it('clears the bonus on the last frame of its life, with the bonus it used still spent', () => {
    const state = buildState({
      level: 2,
      pellets: boardAfterEating(90),
      fruit: { onBoard: FruitKind.Strawberry, framesLeft: 1, spawned: 1 },
    });

    const { state: next, events } = fruitSystem.run(
      state,
      frameContext({ spec: levelSpec(2) }),
      [],
    );

    expect(next.fruit).toEqual({ onBoard: null, framesLeft: 0, spawned: 1 });
    expect(events).toEqual([{ kind: 'fruitExpired', fruit: FruitKind.Strawberry }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: eating is a position test and a table lookup. Nothing about
   *   it needs a ghost, a wave clock or a second frame.
   * MEASURES: that standing on the fruit tile takes the item, scores the
   *   level's value, and reports what was eaten and for how much.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3 "Per-level table", row 1 — the
   *   level 1 bonus is a cherry worth 100 points; 13.4 states that the value
   *   comes from that table and from no second table keyed by fruit.
   * CATCHES: a fruit that cannot be eaten at all — it blinks out after nine
   *   seconds however carefully the player walked to it — and a score that is
   *   ASSIGNED rather than added, which the starting 500 here would expose as a
   *   player who eats a cherry and watches their score fall to 100.
   * LOAD-BEARING: yes.
   */
  it('scores the level one cherry at a hundred when Pac-Man stands on the fruit tile', () => {
    const state = buildState({
      pellets: boardAfterEating(90),
      fruit: { onBoard: FruitKind.Cherry, framesLeft: 300, spawned: 1 },
      score: 500,
      ...standingOn(ARCADE_MAZE.fruitTile),
    });

    const { state: next, events } = fruitSystem.run(state, frameContext(), []);

    expect(next.fruit).toEqual({ onBoard: null, framesLeft: 0, spawned: 1 });
    expect(next.score).toBe(600);
    expect(events).toEqual([{ kind: 'fruitEaten', fruit: FruitKind.Cherry, points: 100 }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: this is the previous test at a second level, which is the
   *   only shape of test that can tell a lookup from a constant.
   * MEASURES: that the points and the item both come from the level spec.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3 "Per-level table", row 13 — the
   *   level 13 bonus is a key worth 5000 points.
   * CATCHES: `points: 100` written into the system. That passes the cherry test
   *   above forever, and costs a player who reaches level 13 4900 points per
   *   fruit while the HUD cheerfully draws a key.
   * LOAD-BEARING: yes.
   */
  it('scores the level thirteen key at five thousand, because the value comes from the level', () => {
    const state = buildState({
      level: 13,
      pellets: boardAfterEating(90),
      fruit: { onBoard: FruitKind.Key, framesLeft: 300, spawned: 2 },
      score: 500,
      ...standingOn(ARCADE_MAZE.fruitTile),
    });

    const { state: next, events } = fruitSystem.run(
      state,
      frameContext({ spec: levelSpec(13) }),
      [],
    );

    expect(next.fruit).toEqual({ onBoard: null, framesLeft: 0, spawned: 2 });
    expect(next.score).toBe(5500);
    expect(events).toEqual([{ kind: 'fruitEaten', fruit: FruitKind.Key, points: 5000 }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the crossing is a property of the pair (before, after), and
   *   a single scoring event is the smallest thing that can produce one.
   * MEASURES: that a bonus large enough to carry the score over 10000 pays the
   *   one extra life — the latch set, the life added, and the event emitted
   *   AFTER the fruit that earned it.
   * ORACLE: docs/ARCADE-REFERENCE.md 13.3 "The extra life: one, at 10000
   *   points", read with section 3 row 13: 6000 + a 5000-point key is 11000, so
   *   the addition leaps the line without landing on it.
   * CATCHES: the extra life being paid for dots only. A key, a melon or a 1600
   *   ghost chain is exactly how a good player crosses 10000 — the score jumps
   *   over the threshold and never equals it, so a system that adds its points
   *   without asking the question silently denies the player the only bonus
   *   life the game gives.
   * LOAD-BEARING: yes.
   */
  it('pays the one extra life when a five thousand point key carries the score across ten thousand', () => {
    const state = buildState({
      level: 13,
      pellets: boardAfterEating(90),
      fruit: { onBoard: FruitKind.Key, framesLeft: 300, spawned: 2 },
      score: 6000,
      lives: 3,
      extraLifeAwarded: false,
      ...standingOn(ARCADE_MAZE.fruitTile),
    });

    const { state: next, events } = fruitSystem.run(
      state,
      frameContext({ spec: levelSpec(13) }),
      [],
    );

    expect(next.score).toBe(11000);
    expect(next.lives).toBe(4);
    /* The latch, so that the next 5000-point key does not pay a second time. */
    expect(next.extraLifeAwarded).toBe(true);
    expect(events).toEqual([
      { kind: 'fruitEaten', fruit: FruitKind.Key, points: 5000 },
      { kind: 'extraLife', lives: 4 },
    ]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: a near miss is two coordinates and one frame.
   * MEASURES: that a bonus is taken only from the tile it is actually on —
   *   from neither the column it stands in nor the row it stands in.
   * ORACLE: the fruit occupies one tile, ARCADE_MAZE.fruitTile (13,17), pinned
   *   in arcade-maze.test.ts against docs/ARCADE-REFERENCE.md; and 13.5 states
   *   the game's one collision test as occupancy of the SAME TILE.
   * CATCHES: a comparison that has lost an axis. Pac-Man's spawn is (13,23),
   *   which shares the fruit's column, and the corridor tile (6,17) shares its
   *   row — so a system comparing only rows, or only columns, harvests the
   *   fruit from six tiles away, and the player is credited for a bonus that
   *   vanishes off the board while they walk toward it.
   * LOAD-BEARING: yes — the bonus must still lose its frame on both of these
   *   frames, which the do-nothing stub does not do.
   */
  it('ignores a bonus Pac-Man is merely lined up with, in either axis', () => {
    expect.assertions(6);
    /* (13,23) is Pac-Man's own spawn, in the fruit's column; (6,17) is the
       corridor on the fruit's row, six tiles to its left. */
    const nearMisses: readonly Tile[] = [ARCADE_MAZE.pacmanSpawn, { col: 6, row: 17 }];

    for (const tile of nearMisses) {
      const state = buildState({
        pellets: boardAfterEating(90),
        fruit: { onBoard: FruitKind.Cherry, framesLeft: 300, spawned: 1 },
        score: 500,
        ...standingOn(tile),
      });

      const { state: next, events } = fruitSystem.run(state, frameContext(), []);

      expect(next.fruit).toEqual({ onBoard: FruitKind.Cherry, framesLeft: 299, spawned: 1 });
      expect(next.score).toBe(500);
      expect(events).toEqual([]);
    }
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the gate is a single comparison on one field.
   * MEASURES: that no part of this system runs outside the playing phase — the
   *   clock does not tick and the fruit under Pac-Man is not eaten — and that
   *   the state comes back as the SAME OBJECT.
   * ORACLE: docs/ARCADE-REFERENCE.md 7.2 with game-phase.ts: `playing` is "the
   *   only phase in which the world is simulated", and the death pause lasts
   *   180 frames.
   * CATCHES: 180 frames of the death animation, plus the 120-frame READY! pause
   *   that follows it, draining out of a 570-frame fruit. The player watches
   *   the ghost eat them and comes back to a bonus with half its life gone —
   *   punished twice for one mistake, in a way no player could ever attribute
   *   to the right cause. Pac-Man is deliberately standing ON the fruit tile
   *   here, so the gate has to cover the eat as well as the countdown.
   * LOAD-BEARING: no — the do-nothing stub is gated by construction. This is
   *   the guard that fixes the gate in place once the rest of the file has
   *   forced the system to start doing things.
   */
  it('does nothing at all outside the playing phase, so the death freeze costs the bonus nothing', () => {
    const state = buildState({
      phase: RoundPhase.Dying,
      phaseFramesLeft: 180,
      pellets: boardAfterEating(90),
      fruit: { onBoard: FruitKind.Cherry, framesLeft: 300, spawned: 1 },
      ...standingOn(ARCADE_MAZE.fruitTile),
    });

    const { state: next, events } = fruitSystem.run(state, frameContext(), []);

    /* Identity, not equality: `runSystems` threads one object through twelve
       systems and never copies it, and a `{ ...state }` here would be invisible
       to every value assertion in this file. */
    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the empty case, which is most frames of most levels.
   * MEASURES: that a frame with no fruit on the board and none due changes
   *   nothing and allocates nothing, even with Pac-Man standing on the tile the
   *   fruit uses.
   * ORACLE: 13.4 — the first bonus is due at 70 dots and not before, so at 69
   *   there is nothing to appear; and the repo's system contract (system.ts,
   *   `unchanged`), which requires a system that changes nothing to return the
   *   state it was given.
   * CATCHES: a `fruitEaten` for 0 points fired every time Pac-Man crosses
   *   (13,17) with the board empty — audible as the fruit stinger firing at
   *   nothing, several times a level — and the quieter defect of returning a
   *   fresh copy of the state each frame, which defeats every identity check
   *   downstream in the pipeline.
   * LOAD-BEARING: no — the stub returns the state unchanged. Guard, and a
   *   deliberate one: it is the only test here that pins object identity on a
   *   frame the system genuinely inspected.
   */
  it('returns the very state it was given when nothing is on the tile and nothing is due', () => {
    const state = buildState({
      pellets: boardAfterEating(69),
      fruit: { onBoard: null, framesLeft: 0, spawned: 0 },
      ...standingOn(ARCADE_MAZE.fruitTile),
    });

    const { state: next, events } = fruitSystem.run(state, frameContext(), []);

    expect(next).toBe(state);
    expect(events).toEqual([]);
  });
});
