import { describe, expect, it } from 'vitest';

import { type Tile } from '../geometry/tile.ts';
import { type Maze } from '../maze/maze.ts';
import { createPelletField, eatAt } from '../maze/pellets.ts';
import { levelSpec } from '../rules/level-table.ts';
import { tinyMaze } from '../testing/tiny-maze.ts';

import { eat } from './eat.ts';

/**
 * Eating: the pellet field, the events, and the freeze frames.
 *
 * WHY THE FREEZE FRAMES MATTER MORE THAN THEY LOOK. docs/ARCADE-REFERENCE.md
 * section 8.2 quotes the Dossier directly:
 *
 *   "Every time Pac-Man eats a regular dot, he stops moving for one frame
 *    (1/60th of a second), slowing his progress by roughly ten percent—just
 *    enough for a following ghost to overtake him. Eating an energizer dot
 *    causes Pac-Man to stop moving for three frames."
 *
 * At level 1 Pac-Man runs at 80% against the ghosts' 75% (section 3). Delete
 * these one and three frames and he is permanently the fastest thing on the
 * board, a competent player simply runs laps, and the game is over as a game.
 * That is why a two-line rule gets three tests: it is not a detail, it is the
 * difficulty.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO. It does not score. A dot is 10
 * points and an energizer is 50, and both numbers belong to `rules/points.ts`
 * in slice s08 with their own citation. The assertions below use `toEqual` on
 * the WHOLE result for exactly that reason: toEqual compares own properties in
 * both directions, so an implementation that started returning `points: 10`
 * would fail these tests. The boundary is asserted, not just described.
 */

/**
 * Five dots, one energizer, one bare tile — the same nine-by-five board as
 * `pellets.test.ts`, redrawn here so this file shows its own situation.
 *
 * ```
 *      col 012345678
 * row 0    #########
 * row 1    ####H####
 * row 2    ####-####
 * row 3    #.o.P...#     . = dot   o = energizer   P = Pac-Man's spawn
 * row 4    #########
 * ```
 *
 * Six edible tiles in all, so after one bite five remain.
 */
function foodMaze(): Maze {
  return tinyMaze(['#########', '####H####', '####-####', '#.o.P...#', '#########']);
}

const DOT: Tile = { col: 1, row: 3 };
const ENERGIZER: Tile = { col: 2, row: 3 };
/** Pac-Man's spawn: open floor with nothing on it. */
const BARE_TILE: Tile = { col: 4, row: 3 };

describe('eat', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One call, one comparison, no frames and no systems. The
   *   expected pellet field is built by calling `eatAt` — a different module,
   *   pinned independently by `pellets.test.ts` — which states the delegation
   *   as part of the expectation rather than duplicating set arithmetic that
   *   would then have to be kept in step by hand.
   * MEASURES: The complete EatResult for a dot: the new field, one pelletEaten
   *   event carrying the tile and the count still on the board, and stopFrames.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.2 — "he stops moving for one
   *   frame" — for the 1. The `remaining: 5` is the fixture's six edible tiles
   *   minus this one, counted off the ASCII above. The event's shape is the
   *   `pelletEaten` variant of GameEvent in docs/ARCHITECTURE.md.
   * CATCHES: A missing freeze, which is the single change that most alters how
   *   the game plays: Pac-Man at 80% against ghosts at 75% never gets caught
   *   again on a full board. Also catches `remaining` reported BEFORE the bite,
   *   which puts the siren one tier behind all level and makes `levelCleared`
   *   fire one dot early or one dot late.
   * LOAD-BEARING: yes (the stub emits no events and no freeze).
   */
  it('takes the dot, freezes Pac-Man for exactly 1 frame, and awards nothing', () => {
    const field = createPelletField(foodMaze());

    expect(eat(field, DOT, levelSpec(1))).toEqual({
      pellets: eatAt(field, DOT),
      events: [{ kind: 'pelletEaten', tile: DOT, remaining: 5 }],
      stopFrames: 1,
    });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Same shape as the dot test, so the two can be read side by
   *   side and the difference — 1 frame versus 3, and a different event —
   *   is the only thing that varies. That contrast is the specification.
   * MEASURES: The complete EatResult for an energizer at level 1, including the
   *   fright duration the event carries.
   * ORACLE: Two sections, and they are separate claims. The 3 comes from
   *   docs/ARCADE-REFERENCE.md section 8.2 ("stop moving for three frames").
   *   The 360 comes from section 3: level 1's fright is 6 seconds, and section
   *   1 converts a second to 60 frames. Neither number is computed here; both
   *   are literals a human can check against the document.
   * CATCHES: The two freezes swapped or collapsed into one value, which makes
   *   energizers cheaper than the arcade intends; or a fright duration invented
   *   here instead of read from the level, so every level frightens the ghosts
   *   for six seconds and the difficulty curve never arrives.
   * LOAD-BEARING: yes (the stub emits no event and stopFrames 0).
   */
  it('takes the energizer, freezes Pac-Man for exactly 3 frames, and reports the level-1 fright of 360 frames', () => {
    const field = createPelletField(foodMaze());

    expect(eat(field, ENERGIZER, levelSpec(1))).toEqual({
      pellets: eatAt(field, ENERGIZER),
      events: [{ kind: 'powerPelletEaten', tile: ENERGIZER, frames: 360 }],
      stopFrames: 3,
    });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A boundary case that is a table lookup away from the test
   *   above, and impossible to reach by playing without surviving eighteen
   *   levels. A unit reaches it in a millisecond by asking for level 19.
   * MEASURES: That the freeze is unconditional at 3 frames while the reported
   *   fright duration is 0.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3 — from level 19 the Fright
   *   column is 0, and the notes on that table state the consequence plainly:
   *   "the level has no fright at all ... no ghost ever turns blue". Section
   *   8.2 attaches the three-frame freeze to the ACT of eating an energizer,
   *   not to fright starting, so the two are independent and this test is what
   *   says so.
   * CATCHES: A freeze written as a side effect of starting fright — `if
   *   (spec.frightenedFrames > 0) stopFrames = 3`. From level 19 on, energizers
   *   would silently stop costing Pac-Man anything, making the hardest levels
   *   in the game easier than level 1 in one specific, invisible way.
   * LOAD-BEARING: yes (the stub's stopFrames is 0, and it emits no event).
   */
  it('still freezes Pac-Man for 3 frames at level 19, where an energizer starts no fright', () => {
    const field = createPelletField(foodMaze());

    expect(eat(field, ENERGIZER, levelSpec(19))).toEqual({
      pellets: eatAt(field, ENERGIZER),
      events: [{ kind: 'powerPelletEaten', tile: ENERGIZER, frames: 0 }],
      stopFrames: 3,
    });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The path taken on the overwhelming majority of frames — a
   *   caller offers Pac-Man's tile to `eat` unconditionally, and almost always
   *   there is nothing on it. Reference identity is asserted rather than deep
   *   equality because "the same value back" is the stronger contract and is
   *   what lets slice s10's eat-system skip its own work.
   * MEASURES: That nothing happened: same field object, no events, no freeze.
   * ORACLE: The stated contract in `eat.ts` and `pellets.ts` — callers need no
   *   guard before eating, so eating nothing must be a no-op.
   * CATCHES: A freeze applied on every frame, which would slow Pac-Man to a
   *   crawl everywhere on the board; or an event emitted with nothing eaten,
   *   which feeds the ghost-house dot counters and the fruit rule with phantom
   *   dots and releases the whole quartet within seconds of the round starting.
   * LOAD-BEARING: no — a guard. The do-nothing stub returns exactly this. It is
   *   kept because it is the published contract for the common case, and it
   *   only means anything read next to the three tests above.
   */
  it('does nothing at all on a tile with no food on it', () => {
    const field = createPelletField(foodMaze());

    const result = eat(field, BARE_TILE, levelSpec(1));

    expect(result.pellets).toBe(field);
    expect(result.events).toEqual([]);
    expect(result.stopFrames).toBe(0);
  });
});
