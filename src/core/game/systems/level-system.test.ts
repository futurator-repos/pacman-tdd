import { describe, expect, it } from 'vitest';

import { type Tile } from '../../geometry/tile.ts';
import { ARCADE_MAZE } from '../../maze/arcade-maze.ts';
import { createPelletField, eatAt, type PelletField } from '../../maze/pellets.ts';
import { buildState } from '../../testing/state-builder.ts';
import { RoundPhase } from '../game-phase.ts';

import { levelSystem } from './level-system.ts';
import { frameContext } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The level system answers one question, sixty times a second: "is the board
 * finished?"
 *
 * It is the smallest system in the pipeline and it owns the single most
 * expensive mistake a Pac-Man can make. Say yes too early and the player is
 * robbed: the round ends with an energizer still blinking on the board, and with
 * it goes the last fright of the level and up to 1600 points a ghost (
 * docs/ARCADE-REFERENCE.md section 13.2, "The ghost ladder"). Say yes too often
 * — every frame, because the board stays empty while the maze flashes — and the
 * 2-second flash never ends and the game hangs on a screen that looks perfectly
 * healthy.
 *
 * So this file is really two claims: WHEN the board is finished (both sets
 * empty, never just the dots), and WHAT ends (the round, not the level — the
 * next level begins when the flash does, which is somebody else's frame).
 *
 * THE FIXTURES ARE THE ARGUMENT. Every pellet field below is derived from the
 * real arcade board by EATING it, tile by tile, with the real `eatAt`. Nothing
 * here hand-writes a `Set` of indices, because the three boards that matter —
 * everything gone, only the four energizers left, only the 240 dots left — are
 * exactly the boards that distinguish a correct "is it cleared?" from the two
 * plausible wrong ones, and a hand-written fixture is free to be a board that
 * cannot occur.
 */

/** Eat every one of `tiles`, in order, from `field`. */
function eatEvery(field: PelletField, tiles: readonly Tile[]): PelletField {
  return tiles.reduce((remainingFood, tile) => eatAt(remainingFood, tile), field);
}

/** The 244 edible tiles a level opens with. docs/ARCADE-REFERENCE.md section 8.1. */
const FULL_BOARD: PelletField = createPelletField(ARCADE_MAZE);

/** 240 dots eaten, 4 energizers still blinking. The board that must NOT clear. */
const ENERGIZERS_LEFT: PelletField = eatEvery(FULL_BOARD, ARCADE_MAZE.pelletTiles);

/** All 4 energizers taken early, 240 dots to go. The mirror of the above. */
const DOTS_LEFT: PelletField = eatEvery(FULL_BOARD, ARCADE_MAZE.powerPelletTiles);

/** All 244 gone. The only board that ends a round. */
const CLEARED_BOARD: PelletField = eatEvery(ENERGIZERS_LEFT, ARCADE_MAZE.powerPelletTiles);

describe('levelSystem', () => {
  /**
   * TYPE: unit.
   * WHY THIS TYPE: the whole behaviour is one decision about one field of the
   *   state. Driving it through `tick` would need Pac-Man walked over 244 tiles
   *   to assert a phase change, and would fail for a dozen reasons that have
   *   nothing to do with this system.
   * MEASURES: that an empty board ends the round — the phase becomes
   *   levelComplete — and that exactly one `levelCleared` naming the CURRENT
   *   level is emitted.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.1, "The dot census: 240 + 4 =
   *   244" — "A level ends when all 244 are gone". The phase it ends into is
   *   section 7.2, "Round-phase durations", whose `levelComplete` row is the
   *   maze flash. The level number on the event is the level that ENDED (level
   *   3 here), per the level-progression contract: the score screen and the
   *   jingle are about the round just finished.
   * CATCHES: the last dot eaten and nothing happens — the player walks an empty
   *   maze forever with no way to progress. And, in the event, the classic
   *   off-by-one: `levelCleared` announcing level 4 while the board on screen is
   *   still level 3's, so the intermission and the HUD disagree.
   * LOAD-BEARING: yes — the stub neither changes the phase nor emits anything.
   */
  it('ends the round when the last of the 244 goes, and names the level that ended', () => {
    const state = buildState({ level: 3, pellets: CLEARED_BOARD });

    const { state: next, events } = levelSystem.run(state, frameContext(), []);

    expect(next.phase).toBe(RoundPhase.LevelComplete);
    /* `toEqual` on the whole array, not `toContainEqual`: this system announces
       the OCCURRENCE and nothing else. The phase system owns timed transitions
       and is the one that emits `phaseChanged`, so a second event here would be
       the same fact told twice down the audio channel. */
    expect(events).toEqual([{ kind: 'levelCleared', level: 3 }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: a duration is one number written into one field; there is
   *   nothing cheaper, and nothing more expensive would say more.
   * MEASURES: that entering levelComplete loads its full countdown.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7.2, "Round-phase durations" —
   *   `levelComplete` is **120 frames** (2 s): "the maze flashes 4 times; at 15
   *   frames per half-flash, 4 x 2 x 15 = 120". The literal 120 is written here
   *   rather than imported, so that a wrong edit to the table is a failure in
   *   this file as well as in the table's own test.
   * CATCHES: a phase entered with a timer of zero. The fixture is a playing
   *   state whose `phaseFramesLeft` is already 0 — which every playing state is,
   *   because play is not on a timer — so an implementation that switches the
   *   phase and forgets the counter leaves the flash lasting no frames at all,
   *   and 180 (the `dying` row, one line above it in the same table) fails too.
   * LOAD-BEARING: yes — the stub leaves the counter at 0.
   */
  it('gives the cleared maze its full 120-frame flash', () => {
    const state = buildState({
      level: 3,
      phase: RoundPhase.Playing,
      phaseFramesLeft: 0,
      pellets: CLEARED_BOARD,
    });

    const { state: next } = levelSystem.run(state, frameContext(), []);

    expect(next.phaseFramesLeft).toBe(120);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: same single decision, taken on a different board. The board
   *   is the whole point of the test, and a unit is the only type in which the
   *   board is visible in the test rather than the product of a long game.
   * MEASURES: that 240 dots eaten with the four energizers untouched is NOT a
   *   cleared board — the state comes back as the SAME OBJECT and nothing is
   *   said.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.1 — "A level ends when all 244
   *   are gone — not when the dots alone are gone, which is why `isCleared` has
   *   to consult both sets."
   * CATCHES: a `pellets.size === 0` check. The round would end with four
   *   energizers still on the board, costing the player the last fright of the
   *   level and up to 1600 points a ghost (section 13.2) — and it would look
   *   like the game simply decided the level was over, with no error and nothing
   *   to debug. This is the exact shape the arcade produces in the endgame,
   *   because a player saves energizers for the ghosts.
   * LOAD-BEARING: no — the stub also does nothing here. A guard, and the most
   *   valuable one in the file: it is the only test a dots-only implementation
   *   fails.
   */
  it('does not end a round that still has its energizers, only its dots eaten', () => {
    const state = buildState({ pellets: ENERGIZERS_LEFT });

    const { state: next, events } = levelSystem.run(state, frameContext(), []);

    /* Identity, not equality: a system that changes nothing must return the very
       object it was handed, and `toEqual` would pass against a copy. */
    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: as above — the fixture is the test.
   * MEASURES: the mirror board. All four energizers eaten, 240 dots left, still
   *   not cleared.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.1 again — 244 means both sets,
   *   read in the other direction.
   * CATCHES: a `powerPellets.size === 0` check, which is the same mistake made
   *   the other way round and is if anything worse: a player who takes all four
   *   energizers in the first few seconds — an ordinary opening — would see the
   *   level end with almost the entire board still covered in dots.
   * LOAD-BEARING: no — guard. The only test an energizers-only implementation
   *   fails.
   */
  it('does not end a round whose energizers are gone but whose dots remain', () => {
    const state = buildState({ pellets: DOTS_LEFT });

    const { state: next, events } = levelSystem.run(state, frameContext(), []);

    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: this is about what happens on the SECOND frame of a
   *   condition, which is a statement about one call made from the state the
   *   previous call produced. A unit says it in three lines.
   * MEASURES: that a board which is still empty while the maze is already
   *   flashing does not clear again.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7.2 — `levelComplete` lasts 120
   *   frames. A phase with a fixed duration must be able to reach the end of it.
   * CATCHES: the bug that ships if this system only looks at the pellets. The
   *   board stays empty for all 120 frames of the flash, so the transition would
   *   fire again on every one of them: `phaseFramesLeft` is reloaded to 120
   *   forever and the maze flashes until the machine is switched off, while 120
   *   `levelCleared` events pour down the audio channel and the jingle restarts
   *   sixty times a second. Nothing crashes, and the screen looks exactly right
   *   for the first two seconds.
   * LOAD-BEARING: no — the stub is idle in every phase. A guard, and the reason
   *   the phase check exists at all.
   */
  it('does not clear the board again while the maze is already flashing', () => {
    const state = buildState({
      level: 3,
      phase: RoundPhase.LevelComplete,
      phaseFramesLeft: 119,
      pellets: CLEARED_BOARD,
    });

    const { state: next, events } = levelSystem.run(state, frameContext(), []);

    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: three fields of the produced state, asserted directly. An
   *   integration test through the pipeline would assert the same three fields
   *   after a great deal more setup.
   * MEASURES: that ending the round changes the round and nothing else — the
   *   level number is untouched, the emptied board is the very same object, and
   *   the score survives.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7.2 — the `levelComplete` phase IS
   *   the flash of the board that was just cleared, so that board has to still
   *   be there to flash. And the `startRound` contract in
   *   src/core/game/new-game.ts: the score, the lives and the high score belong
   *   to the GAME, never to the round.
   * CATCHES: calling `startRound(state, level + 1)` here instead of on the frame
   *   the flash ends. The player would watch a FULL 244-dot maze flash — the
   *   next level's board, presented as the one they just finished — and every
   *   actor would be standing on its spawn tile two seconds early. The score
   *   assertion catches the worse version of the same mistake, `startGame()`,
   *   which wipes the player's entire run at every level transition.
   * LOAD-BEARING: no — the stub changes none of these three. A guard against a
   *   specific over-implementation.
   */
  it('leaves the level number, the emptied board and the score alone', () => {
    const state = buildState({ level: 3, score: 4520, pellets: CLEARED_BOARD });

    const { state: next } = levelSystem.run(state, frameContext(), []);

    expect(next.level).toBe(3);
    expect(next.pellets).toBe(state.pellets);
    expect(next.score).toBe(4520);
  });
});
