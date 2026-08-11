import { describe, expect, it } from 'vitest';

import { CLASSIC_LAYOUT } from './classic-layout.ts';
import { parseMaze, renderMaze } from './parse-maze.ts';

/**
 * Turning authored ASCII into a board — and refusing, loudly, when it cannot.
 *
 * Every rejection test below uses a THREE-BY-THREE fixture rather than the real
 * 28x31 board. That is deliberate: a failure message about a nine-character
 * maze is about the RULE, while the same failure on the arcade board is about
 * the board, and the reader has to go and find which of 868 characters was
 * meant to be wrong. Small fixtures are how a test says what it is testing.
 *
 * All row and column indices here are zero-based, matching Tile.col / Tile.row.
 */

/** Row 2 is one character short — the single most likely hand-authoring slip. */
const RAGGED_ROWS: readonly string[] = ['###', '#P#', '#-'];

/** `X` is in no legend. It sits at row 1, column 2. */
const UNKNOWN_GLYPH_ROWS: readonly string[] = ['###', '#PX', '#-#'];

/** A legal little board in every respect except that it has no `-` gate. */
const NO_DOOR_ROWS: readonly string[] = ['###', '#P#', '###'];

/** A legal little board in every respect except that it has no `P`. */
const NO_SPAWN_ROWS: readonly string[] = ['###', '#-#', '###'];

describe('parseMaze', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One 3x3 fixture with one short row. The subject is a
   *   decision — reject rather than pad — which a single example states
   *   perfectly. Nothing cheaper can express a throw; nothing more expensive
   *   would add information.
   * MEASURES: That a ragged layout cannot produce a Maze at all, and that the
   *   thrown message names the offending row and both widths.
   * ORACLE: The stated invariant of the Maze record — `tiles` is a FLAT,
   *   row-major array of length columns*rows — so ragged input has no legal
   *   representation. Row 0 declares the width; row 2 here is two characters.
   * CATCHES: One missing character in the 868-character board silently shifting
   *   every tile after it by one column. The maze looks almost right, has walls
   *   in slightly wrong places, and a player finds it before CI does. Asserting
   *   on the MESSAGE as well as the throw is what stops the fix being "which
   *   row?" followed by an afternoon of counting.
   * LOAD-BEARING: yes — the stub throws nothing whatsoever.
   */
  it('rejects a row that is not the declared width, naming the offending row', () => {
    expect(() => parseMaze(RAGGED_ROWS)).toThrow(/row 2/);
    expect(() => parseMaze(RAGGED_ROWS)).toThrow(/2 columns/);
    expect(() => parseMaze(RAGGED_ROWS)).toThrow(/expected 3/);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: One 3x3 fixture with one bad character. Again the subject is
   *   a decision — fail loudly versus default quietly — and one example says it.
   * MEASURES: That the legend is a CLOSED set with no fallback, and that the
   *   message names the row, the column and the character.
   * ORACLE: The stated design rule for authored data in this repository: fail
   *   loudly. It is the same rule `validateSprite` already applies to a pixel
   *   key that is missing from the palette, and `load-atlas` to an unexpected
   *   field in an untrusted manifest.
   * CATCHES: A typo'd character quietly becoming open floor. That is a hole in
   *   a wall — Pac-Man walks out of the maze, or a pocket of the board becomes
   *   reachable that never should be — and it is found by a player rather than
   *   by a build.
   * LOAD-BEARING: yes.
   */
  it('rejects an unknown legend character instead of treating it as open floor', () => {
    expect(() => parseMaze(UNKNOWN_GLYPH_ROWS)).toThrow(/row 1/);
    expect(() => parseMaze(UNKNOWN_GLYPH_ROWS)).toThrow(/column 2/);
    expect(() => parseMaze(UNKNOWN_GLYPH_ROWS)).toThrow(/'X'/);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Unit on a fixture. The requirement is structural — a field
   *   that must exist — and demonstrating it needs no movement, no ghost and no
   *   frame.
   * MEASURES: That `Maze.houseDoorTile` is genuinely non-optional rather than
   *   quietly defaulted.
   * ORACLE: Arcade rule — ghosts leave the house through a gate tile that only
   *   they may cross. A board with no gate cannot release a ghost, so it is not
   *   a board.
   * CATCHES: A door defaulted to tile (0,0), which on this board is a corner
   *   wall. Every ghost then heads for the corner to "enter the house" and jams
   *   forever, and the symptom a human reports — "the ghosts never come out" —
   *   points nowhere near the parser.
   * LOAD-BEARING: yes.
   */
  it('rejects a layout with no ghost-house door', () => {
    expect(() => parseMaze(NO_DOOR_ROWS)).toThrow(/door/i);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Same shape and same cost as the door case. The two are
   *   listed separately on purpose: a parser that validates one required field
   *   and forgets the other is exactly the plausible bug, and a single combined
   *   test would not distinguish them.
   * MEASURES: That every Maze field later code treats as always-present is
   *   validated once, at construction.
   * ORACLE: The stated invariant — `Maze.pacmanSpawn` is non-optional, and
   *   `startGame` places Pac-Man there with no fallback of its own.
   * CATCHES: `startGame` spawning Pac-Man at a defaulted (0,0), inside the
   *   corner wall, blocked in all four directions and unable to move on any
   *   input — a game that is broken before the first frame.
   * LOAD-BEARING: yes.
   */
  it('rejects a layout with no Pac-Man spawn', () => {
    expect(() => parseMaze(NO_SPAWN_ROWS)).toThrow(/Pac-Man/i);
    expect(() => parseMaze(NO_SPAWN_ROWS)).toThrow(/spawn/i);
  });
});

describe('renderMaze', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: A round trip, and deliberately NOT a snapshot. A snapshot of
   *   the parsed tile grid would have no oracle at all: whatever the parser
   *   produced on day one would become the expected value forever, and a reader
   *   could never check it. Here the authored layout IS the expected value, and
   *   a failure prints two blocks of ASCII a human can read side by side.
   * MEASURES: That the legend maps each character to the kind it names, that
   *   the row-major index arithmetic addresses the tile the ASCII shows, and
   *   that the markers (spawns, fruit) landed on the tiles they were drawn on.
   * ORACLE: CLASSIC_LAYOUT itself — 31 authored rows plus the legend in
   *   classic-layout.ts, both reviewable in a diff.
   * CATCHES: Tunnel tiles parsed as plain open floor, which is invisible in
   *   play until a ghost fails to slow down in the tunnel; or a transposed
   *   index (`col * rows + row`) that mirrors the whole board along its
   *   diagonal, which on a symmetric board is far less obvious than it sounds.
   * LOAD-BEARING: yes — but only because of the FIRST assertion. Note the
   *   literal 31 rather than MAZE_ROWS: with both sides of the comparison
   *   stubbed, `[] toEqual []` would pass and this test would report success
   *   against a parser and a renderer that both do nothing. An expected value
   *   must come from the oracle, never from another stub.
   */
  it('renders a parsed maze back to the exact ASCII it was parsed from', () => {
    const rendered = renderMaze(parseMaze(CLASSIC_LAYOUT));

    expect(rendered).toHaveLength(31);
    expect(rendered).toEqual(CLASSIC_LAYOUT);
  });
});
