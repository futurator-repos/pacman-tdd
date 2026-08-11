import { describe, expect, it } from 'vitest';

import { Direction } from '../../geometry/direction.ts';
import type { Tile } from '../../geometry/tile.ts';
import { GhostId } from '../ghost-id.ts';
import { type Ghost, GhostPhase } from '../ghost.ts';

import { clydeTarget } from './clyde.ts';
import type { TargetContext } from './target-context.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * Clyde is the cowardly one, and he is the only ghost whose rule reads his OWN
 * position. Far from Pac-Man he behaves exactly like Blinky; get within eight
 * tiles and he loses his nerve and heads for his corner — which is what makes
 * the bottom-left of the board the safest place to be, and why an expert player
 * can park there.
 *
 * The comparison is done on SQUARED distance against 64, never on distance
 * against 8: the arcade takes no square root (`tile-distance.ts` exists for
 * exactly this reason), and squaring keeps the comparison in exact integers
 * where a tie is a tie rather than a float coin-toss.
 *
 * ---------------------------------------------------------------------------
 * WHY THE EXPECTED CORNER IS A LITERAL AND NOT `SCATTER_CORNERS.clyde`
 *
 * Referring to the constant would look tidier and would be a trap. In the RED
 * phase both this module and `scatter-corners.ts` are inert stubs returning
 * {col: 0, row: 0}, so `expect(clydeTarget(...)).toEqual(SCATTER_CORNERS.clyde)`
 * would compare one stub against another and PASS while checking nothing —
 * failure mode 2 in docs/TDD-FINDINGS.md, dressed up as good practice. The
 * literal below is pinned to the same value in scatter-corners.test.ts, which
 * is where that constant belongs; if the two ever disagree, that test fails.
 * ---------------------------------------------------------------------------
 */

/** Pac-Man, and the tile Clyde must return when he is brave enough to chase. */
const PACMAN_TILE: Tile = { col: 10, row: 10 };

/** Clyde's scatter corner: the bottom-left of the board, ROM screen-space
 *  (0, 35), which this codebase places on the playfield's bottom-left border
 *  tile (0, 30). Pinned as a constant, with the coordinate-space reasoning, in
 *  scatter-corners.test.ts — repeated as a literal here on purpose, see above. */
const CLYDE_CORNER: Tile = { col: 0, row: 30 };

const ORIGIN: Tile = { col: 0, row: 0 };

/** Clyde's rule never reads the maze; TargetContext requires one. See the
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

/**
 * Clyde standing at the CENTRE of the given tile.
 *
 * Positions are whole pixels, tiles are 8 pixels, and slice s01's `centreOf`
 * puts the centre at (col*8 + 4, row*8 + 4) — the same convention that makes
 * `centreOf({col:2,row:3})` equal {x:20, y:28} (docs/ARCADE-REFERENCE.md:
 * TILE_SIZE is 8). The arithmetic is written out rather than importing
 * `centreOf` and `TILE_SIZE`, because both are still RED-phase stubs in slice
 * s01 — `TILE_SIZE` is currently 0 there — and a fixture built from another
 * slice's inert stub would put Clyde at a position that means nothing.
 */
function clydeAt(tile: Tile): Ghost {
  return {
    id: GhostId.Clyde,
    actor: {
      position: { x: tile.col * 8 + 4, y: tile.row * 8 + 4 },
      facing: Direction.Left,
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
}

const CHASE_CONTEXT: TargetContext = {
  maze: IRRELEVANT_MAZE,
  pacmanTile: PACMAN_TILE,
  /* Clyde reads neither the facing nor Blinky's tile. Both are present because
     TargetContext is one shape for all four personalities. */
  pacmanFacing: Direction.Right,
  blinkyTile: { col: 1, row: 1 },
  mode: 'chase',
};

/**
 * TYPE: unit (the three threshold cases below; the fourth test, which pins the
 *   distance METRIC rather than the threshold, carries its own note)
 * WHY THIS TYPE: a threshold rule with exactly three interesting inputs —
 *   above, exactly at, and below. Three unit calls pin the comparison operator
 *   itself. An integration test would exercise one arbitrary distance and leave
 *   the `>` versus `>=` question open, which is the only question here.
 * MEASURES: which of the two targets clydeTarget returns as his squared
 *   distance to Pac-Man crosses 64. Pac-Man is at (10,10) throughout and Clyde
 *   is moved along the row: (19,10) is dx=9 -> 81, (18,10) is dx=8 -> exactly
 *   64, (17,10) is dx=7 -> 49. Note that 64 is reachable at all only because it
 *   is 8^2 + 0^2; over integer tiles there is no diagonal pair at exactly eight
 *   tiles, so the boundary case must be placed on a straight line.
 * ORACLE: docs/ARCADE-REFERENCE.md — Clyde (Guzuta, "Pokey") chases Pac-Man's
 *   tile while his distance is GREATER than eight tiles and targets his own
 *   scatter corner at eight tiles or nearer. Compared as squared distance
 *   against 64 because the arcade never takes a square root.
 * CATCHES: `>` written as `>=` (or the comparison done against 8 while the
 *   distance is squared, which puts the boundary at sixty-four tiles). Clyde
 *   then either never runs away or never chases, and the cowardice that is his
 *   entire personality — and the safe corner that depends on it — is gone.
 * LOAD-BEARING: all three yes — the stub returns {col: 0, row: 0}, which is
 *   neither Pac-Man's tile (10,10) nor Clyde's corner (0,30).
 */
describe('clydeTarget', () => {
  it("chases pac-man's tile when he is further than eight tiles away", () => {
    /* Nine tiles east of Pac-Man: squared distance 81 > 64. */
    expect(clydeTarget(clydeAt({ col: 19, row: 10 }), CHASE_CONTEXT)).toEqual(PACMAN_TILE);
  });

  it('retreats to his scatter corner at exactly eight tiles, the boundary itself', () => {
    /* Eight tiles east: squared distance exactly 64. The arcade's comparison is
       "greater than 64", so the boundary belongs to the retreat. */
    expect(clydeTarget(clydeAt({ col: 18, row: 10 }), CHASE_CONTEXT)).toEqual(CLYDE_CORNER);
  });

  it('retreats to his scatter corner when he is nearer than eight tiles', () => {
    /* Seven tiles east: squared distance 49 < 64. */
    expect(clydeTarget(clydeAt({ col: 17, row: 10 }), CHASE_CONTEXT)).toEqual(CLYDE_CORNER);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: same pure function, but the three tests above place Clyde on
   *   Pac-Man's own row, which pins the comparison OPERATOR while leaving the
   *   DISTANCE METRIC entirely unpinned. Two wrong metrics survive all three of
   *   them, and both are metrics a plausible implementation might reach for.
   * MEASURES: that the distance is the squared EUCLIDEAN distance over both
   *   axes, by using two placements no other test in this file can see:
   *     Clyde (10,20), ten tiles due SOUTH of Pac-Man (10,10):
   *       squared 0^2 + 10^2 = 100 > 64  -> chase
   *     Clyde (15,15), five tiles diagonally:
   *       squared 5^2 + 5^2  = 50  < 64  -> retreat
   * ORACLE: docs/ARCADE-REFERENCE.md — the eight-tile radius is a radius, not a
   *   column gap and not a city-block walk; the arcade compares the squared
   *   Euclidean distance against 64, which is why `squaredDistance` sums BOTH
   *   squared differences (src/core/geometry/tile-distance.ts).
   * CATCHES: exactly the two survivors of the tests above.
   *   - A column-only comparison (`(clyde.col - pac.col) ** 2 > 64`): it answers
   *     "retreat" for the southern placement, where the truth is chase. Clyde
   *     would then lose his nerve at any vertical distance whatsoever and stop
   *     chasing up and down the long side corridors.
   *   - Manhattan distance (`|dcol| + |drow| > 8`): it answers "chase" for the
   *     diagonal placement, where the truth is retreat. Clyde's safe zone
   *     changes from a circle to a diamond and the bottom-left safe spot the
   *     rule exists to create shrinks.
   *   Both leave every other assertion in this suite green.
   * LOAD-BEARING: yes — the stub returns {col: 0, row: 0}, which is neither
   *   Pac-Man's tile (10,10) nor Clyde's corner (0,30).
   */
  it('measures the radius over both axes, so a column gap and a city block are not distances', () => {
    /* Due south, ten tiles: 0^2 + 10^2 = 100 > 64. */
    expect(clydeTarget(clydeAt({ col: 10, row: 20 }), CHASE_CONTEXT)).toEqual(PACMAN_TILE);

    /* Diagonal, five and five: 5^2 + 5^2 = 50 < 64, though the city-block walk
       between the two tiles is ten. */
    expect(clydeTarget(clydeAt({ col: 15, row: 15 }), CHASE_CONTEXT)).toEqual(CLYDE_CORNER);
  });
});
