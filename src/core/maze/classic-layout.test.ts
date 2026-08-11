import { describe, expect, it } from 'vitest';

import { CLASSIC_LAYOUT, MazeGlyph } from './classic-layout.ts';

/**
 * The arcade board, as authored data.
 *
 * These four tests never touch the parser. They read the ASCII directly,
 * because the board is DATA and data deserves to be checked where it is
 * written — a census failure here says "you typed the board wrong", while the
 * same failure discovered through `parseMaze` says "something, somewhere, is
 * wrong", which is a much worse morning.
 *
 * The three of them work as a set, and the plan says so out loud: the census
 * and the coordinates are load-bearing, the symmetry test is a GUARD that an
 * empty board would also satisfy, and it is only meaningful sitting directly
 * beneath the two tests that rule the empty board out.
 */

/** A named local type, so a test can build coordinates without importing `Tile`. */
interface Coordinate {
  readonly col: number;
  readonly row: number;
}

/**
 * `glyph` classified for the symmetry check.
 *
 * Terrain and food are mirrored; the single-tile MARKERS are not, because
 * Pac-Man, the fruit and the four ghosts each sit on one side of the centre
 * line by definition. Written as a function with explicit branches rather than
 * a chain of ternaries so that the three buckets are legible.
 */
function mirrorClass(glyph: string): string {
  if (glyph === MazeGlyph.Wall) {
    return 'wall';
  }
  if (glyph === MazeGlyph.Pellet || glyph === MazeGlyph.PowerPellet) {
    return 'dot';
  }
  return 'floor';
}

/**
 * `row` classified left-to-right, and again right-to-left.
 *
 * Built with `charAt` and an index loop rather than by spreading the string:
 * `no-misused-spread` is an eslint error here, and for a good reason — spreading
 * a string iterates code POINTS, which is not the same as its indices.
 */
function mirrorPair(row: string): { readonly forward: string; readonly reversed: string } {
  let forward = '';
  let reversed = '';
  for (let col = 0; col < row.length; col += 1) {
    forward += mirrorClass(row.charAt(col));
    reversed += mirrorClass(row.charAt(row.length - 1 - col));
  }
  return { forward, reversed };
}

describe('CLASSIC_LAYOUT', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: Two facts about a string array. Nothing to integrate and no
   *   randomness to explore, so a unit is both the cheapest and the most precise
   *   type available.
   * MEASURES: The row count of the authored board, and the width of every
   *   single row — not just the first.
   * ORACLE: docs/ARCADE-REFERENCE.md — the original Pac-Man playfield is 28
   *   tiles wide and 31 tiles tall (224 x 248 pixels at 8 px per tile).
   * CATCHES: A row dropped or duplicated while hand-authoring 868 characters.
   *   Every tile below the mistake shifts by a whole row: the ghost house
   *   lands one row off the door, Pac-Man spawns in a wall, and the failure
   *   surfaces as "ghosts never leave the house", miles from the typo.
   *   The per-row width assertion additionally catches the single missing
   *   character that `parseMaze`'s ragged-row check would only find later.
   * LOAD-BEARING: yes — CLASSIC_LAYOUT is stubbed to []. Note the
   *   expect.assertions(32): without it the loop over an empty array would run
   *   zero times, and this test would report success while checking one thing.
   */
  it('is exactly 28 columns by 31 rows, the original arcade playfield', () => {
    expect.assertions(32);
    expect(CLASSIC_LAYOUT).toHaveLength(31);
    for (const row of CLASSIC_LAYOUT) {
      expect(row).toHaveLength(28);
    }
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A census over authored data. This one cheap test is the only
   *   practical defence against a single-character typo in 868 characters of
   *   hand-written ASCII, and it costs a millisecond instead of the several
   *   minutes it would take to play a level and count.
   * MEASURES: How many dots and how many energizers the board holds.
   * ORACLE: docs/ARCADE-REFERENCE.md — every level of the original contains
   *   240 dots and 4 energizers, 244 in total.
   * CATCHES: 241 dots. The level still clears, fruit still triggers, and the
   *   only symptom is a perfect score that is 10 points off the arcade — which
   *   no player would report and no other test would notice. The reverse, 239,
   *   is worse: every dots-eaten trigger in the game (fruit at 70 and at 170,
   *   Cruise Elroy's dots-remaining thresholds) shifts by one dot, permanently.
   * LOAD-BEARING: yes — 0 is not 240.
   */
  it('holds exactly 240 dots and 4 energizers, the arcade total of 244 per level', () => {
    let dots = 0;
    let energizers = 0;
    for (const row of CLASSIC_LAYOUT) {
      for (let col = 0; col < row.length; col += 1) {
        const glyph = row.charAt(col);
        if (glyph === MazeGlyph.Pellet) {
          dots += 1;
        }
        if (glyph === MazeGlyph.PowerPellet) {
          energizers += 1;
        }
      }
    }

    expect(dots).toBe(240);
    expect(energizers).toBe(4);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Four exact coordinates against authored data, collected in
   *   row-major order so the ORDER of the array is itself part of the claim.
   *   The citation is in the test name so a reader can go and check the fact
   *   rather than trust this file.
   * MEASURES: WHERE the energizers are, which the census above deliberately
   *   does not say.
   * ORACLE: docs/ARCADE-REFERENCE.md — the four energizer tiles of the original
   *   board sit at columns 1 and 26 of rows 3 and 23, zero-based.
   * CATCHES: An energizer typed one tile off. The count is still 4 and the
   *   board still clears, but the distance Pac-Man must travel to reach fright
   *   changes — which silently invalidates every documented arcade pattern, the
   *   ones players actually memorise.
   * LOAD-BEARING: yes — the empty board yields an empty list.
   */
  it('places the four energizers at the arcade coordinates (1,3) (26,3) (1,23) (26,23)', () => {
    const found: Coordinate[] = [];
    for (let row = 0; row < CLASSIC_LAYOUT.length; row += 1) {
      const line = CLASSIC_LAYOUT[row] ?? '';
      for (let col = 0; col < line.length; col += 1) {
        if (line.charAt(col) === MazeGlyph.PowerPellet) {
          found.push({ col, row });
        }
      }
    }

    expect(found).toEqual([
      { col: 1, row: 3 },
      { col: 26, row: 3 },
      { col: 1, row: 23 },
      { col: 26, row: 23 },
    ]);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A single fold over the authored rows, compared with one
   *   assertion. No loop carries an assertion, so there is no vacuous-pass
   *   hazard inside the test — the hazard is the test itself, see below.
   * MEASURES: Mirror symmetry of the WALLS and the DOTS across the vertical
   *   centre line. The single-tile markers (P, 1-4, F) are excluded by
   *   construction, since each of them sits on one side of the line by
   *   definition.
   * ORACLE: The original board is mirror-symmetric about its vertical centre
   *   line — a property of the arcade artwork, checkable from any screenshot.
   * CATCHES: A wall piece typed into the left half and forgotten on the right.
   *   The board still parses, the dot count can still be exactly 240, and the
   *   maze simply looks subtly wrong for the rest of the project's life.
   * LOAD-BEARING: NO — a guard, and honestly so. An empty layout and a
   *   uniformly walled one both satisfy it, which is exactly why it is written
   *   directly beneath the dimension and census tests. Those two rule out the
   *   degenerate boards; this one then means something. None of the three does
   *   the job alone, and saying so is the instructive part.
   */
  it('is left/right symmetric about the vertical centre line in its walls and its dots', () => {
    const forward = CLASSIC_LAYOUT.map((row) => mirrorPair(row).forward);
    const reversed = CLASSIC_LAYOUT.map((row) => mirrorPair(row).reversed);

    expect(reversed).toEqual(forward);
  });
});
