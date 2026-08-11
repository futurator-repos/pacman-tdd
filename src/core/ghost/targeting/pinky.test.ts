import { describe, expect, it } from 'vitest';

import { Direction } from '../../geometry/direction.ts';
import type { Tile } from '../../geometry/tile.ts';
import { GhostId } from '../ghost-id.ts';
import { type Ghost, GhostPhase } from '../ghost.ts';

import { pinkyTarget } from './pinky.ts';
import type { TargetContext } from './target-context.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * Pinky is the ambusher: she aims at where Pac-Man is GOING, not where he is,
 * which is what produces the pincer with Blinky and the feeling of being cut
 * off at a junction. Her rule is four tiles ahead of Pac-Man's facing.
 *
 * And then there is the bug — see the second test. It is the most instructive
 * line in the whole game, and it is reproduced here on purpose.
 *
 * Types owned by parallel slices are imported with the erasing `import type`
 * statement form, so this file executes and fails on its assertions even when
 * the slice that owns them has not landed. See blinky.test.ts for the full
 * explanation.
 */

/** Pac-Man parked at a tile with plenty of room in all four directions, and a
 *  long way from the origin so the stub's {0,0} can never be a right answer. */
const PACMAN_TILE: Tile = { col: 10, row: 12 };

const ORIGIN: Tile = { col: 0, row: 0 };

/** Pinky's rule never reads the maze; TargetContext requires one. See the
 *  longer explanation of this fixture in blinky.test.ts. */
const IRRELEVANT_MAZE = {
  columns: 0,
  rows: 0,
  tiles: [],
  pelletTiles: [],
  powerPelletTiles: [],
  noUpTiles: new Set<number>(),
  pacmanSpawn: ORIGIN,
  ghostSpawns: { blinky: ORIGIN, pinky: ORIGIN, inky: ORIGIN, clyde: ORIGIN },
  scatterTargets: { blinky: ORIGIN, pinky: ORIGIN, inky: ORIGIN, clyde: ORIGIN },
  houseDoorTile: ORIGIN,
  houseCentreTile: ORIGIN,
  fruitTile: ORIGIN,
  tunnelRow: 0,
};

const PINKY: Ghost = {
  id: GhostId.Pinky,
  actor: {
    position: { x: 108, y: 116 },
    facing: Direction.Right,
    queued: null,
    carrySubPixels: 0,
  },
  phase: GhostPhase.Hunting,
  frightenedFramesLeft: 0,
  dotCounter: 0,
  dotCounterActive: false,
  elroyStage: 0,
  reverseQueued: false,
};

function contextFacing(pacmanFacing: Direction): TargetContext {
  return {
    maze: IRRELEVANT_MAZE,
    pacmanTile: PACMAN_TILE,
    pacmanFacing,
    /* Only Inky may read this. If Pinky's rule ever consults it, the numbers
       below stop adding up. */
    blinkyTile: { col: 1, row: 1 },
    mode: 'chase',
  };
}

describe('pinkyTarget', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: a pure function of a tile and a facing. Three facings are
   *   three cheap cases in one table-driven unit; saying the same thing through
   *   the game would need three whole GameStates and a mover, and a failure
   *   would not say which of the two was wrong.
   * MEASURES: that the target is pacmanTile offset by FOUR TILES along the
   *   facing — right (14,12), left (6,12), down (10,16) from Pac-Man at
   *   (10,12).
   * ORACLE: docs/ARCADE-REFERENCE.md — Pinky (Pinky, "Speedy") targets the tile
   *   four ahead of Pac-Man's current facing. Four TILES, i.e. 32 pixels at
   *   TILE_SIZE 8, not four pixels.
   * CATCHES: an off-by-one (three ahead), or the offset applied in pixels
   *   rather than tiles. Pinky stops cutting Pac-Man off at junctions, the
   *   ambush disappears and the game becomes markedly easier — a change nothing
   *   else in the suite can see.
   * LOAD-BEARING: yes — the stub returns {col: 0, row: 0}.
   */
  it('targets four tiles ahead of pac-man when pac-man faces left, right or down', () => {
    const cases: readonly { readonly facing: Direction; readonly expected: Tile }[] = [
      { facing: Direction.Right, expected: { col: 14, row: 12 } },
      { facing: Direction.Left, expected: { col: 6, row: 12 } },
      /* Screen coordinates: down is +row. */
      { facing: Direction.Down, expected: { col: 10, row: 16 } },
    ];

    /* Vacuity guard: an empty table would leave this test asserting nothing
       while still reporting success. */
    expect.assertions(3);

    for (const { facing, expected } of cases) {
      expect(pinkyTarget(PINKY, contextFacing(facing))).toEqual(expected);
    }
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: one arithmetic quirk, in its own named test rather than as a
   *   fourth row of the table above — precisely so the NAME can carry the
   *   warning. This is the test whose title does most of the work.
   * MEASURES: that facing up produces { col: pac.col - 4, row: pac.row - 4 },
   *   i.e. (6, 8) from Pac-Man at (10, 12) — and NOT the "correct" (10, 8).
   * ORACLE: docs/ARCADE-REFERENCE.md — the original's position-offset routine
   *   adds the direction's offset to BOTH axes when the direction is up. The
   *   ROM's table holds the up vector as (-4, -4) rather than (0, -4), so "four
   *   ahead" while facing up is also four to the LEFT. This is documented ROM
   *   behaviour of the 1980 machine, reproduced deliberately.
   *
   *   ****************************************************************
   *   THIS IS THE ARCADE'S BUG, AND IT IS OURS ON PURPOSE.
   *   It is not a defect in this codebase, it is not a typo, and it must
   *   not be "fixed". Fidelity to the original is the specification.
   *   Every Pac-Man player alive has learned Pinky's real ambush angles
   *   from the buggy machine; correcting the arithmetic would make this
   *   game play differently from the one being reproduced.
   *   ****************************************************************
   *
   * CATCHES: a future reader who spots the asymmetry and "fixes" it. Pinky's
   *   ambush geometry then changes on every upward corridor — including the
   *   famous safe spots, which exist BECAUSE of this bug — and the fidelity of
   *   the reproduction is silently lost with no crash and no other red test.
   * LOAD-BEARING: yes — the stub returns {col: 0, row: 0}, and the wrong-but-
   *   plausible answer (10, 8) would fail here too, which is the point.
   */
  it('targets four up AND four left when pac-man faces up, reproducing the original hardware overflow', () => {
    expect(pinkyTarget(PINKY, contextFacing(Direction.Up))).toEqual({ col: 6, row: 8 });
  });
});
