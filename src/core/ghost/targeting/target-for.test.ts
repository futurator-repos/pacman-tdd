import { describe, expect, it } from 'vitest';

import { Direction } from '../../geometry/direction.ts';
import type { Tile } from '../../geometry/tile.ts';
import { GhostId } from '../ghost-id.ts';
import { type Ghost, GhostPhase } from '../ghost.ts';

import type { TargetContext } from './target-context.ts';
import { targetFor } from './target-for.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * `targetFor` is a dispatch contract, not arithmetic. The four personality
 * rules are each pinned in their own file; re-asserting them here would double
 * the cost of every future change to them and tell us nothing new. What is
 * tested here is the ORDER OF THE QUESTIONS:
 *
 *   1. Are these eyes going home?   -> the house door, whatever the mode.
 *   2. Is the global mode scatter?  -> this ghost's fixed corner.
 *   3. Otherwise                    -> ask the personality.
 *
 * Phase before personality. Get that order backwards and an eaten Blinky's eyes
 * chase Pac-Man instead of going home, never re-enter the house, and the level
 * silently continues with three ghosts.
 */

const HOUSE_DOOR: Tile = { col: 21, row: 5 };

const PACMAN_TILE: Tile = { col: 7, row: 20 };

/** From docs/ARCADE-REFERENCE.md, placed in playfield space; pinned as
 *  constants, with the coordinate-space reasoning, in scatter-corners.test.ts.
 *  Repeated as literals here on purpose — see the note in clyde.test.ts about
 *  the trap of comparing one stub against another. */
const BLINKY_CORNER: Tile = { col: 25, row: 0 };
const CLYDE_CORNER: Tile = { col: 0, row: 30 };

const ORIGIN: Tile = { col: 0, row: 0 };

/**
 * Unlike the personality fixtures, this maze IS read: the eyes rules return
 * `ctx.maze.houseDoorTile`. Its door is deliberately (21, 5) — a tile the real
 * board's door is nowhere near — so these tests pin the DELEGATION and cannot
 * accidentally pass by agreeing with the arcade door coordinate, which is slice
 * s02's to pin.
 */
const FIXTURE_MAZE = {
  columns: 0,
  rows: 0,
  tiles: [],
  pelletTiles: [],
  powerPelletTiles: [],
  noUpTiles: new Set<number>(),
  pacmanSpawn: ORIGIN,
  ghostSpawns: { blinky: ORIGIN, pinky: ORIGIN, inky: ORIGIN, clyde: ORIGIN },
  scatterTargets: { blinky: ORIGIN, pinky: ORIGIN, inky: ORIGIN, clyde: ORIGIN },
  houseDoorTile: HOUSE_DOOR,
  houseCentreTile: ORIGIN,
  fruitTile: ORIGIN,
  tunnelRow: 0,
};

function ghost(id: GhostId, phase: GhostPhase): Ghost {
  return {
    id,
    actor: {
      position: { x: 100, y: 100 },
      facing: Direction.Left,
      queued: null,
      carrySubPixels: 0,
    },
    phase,
    frightenedFramesLeft: 0,
    dotCounter: 0,
    dotCounterActive: false,
    elroyStage: 0,
    reverseQueued: false,
  };
}

function contextIn(mode: TargetContext['mode']): TargetContext {
  return {
    maze: FIXTURE_MAZE,
    pacmanTile: PACMAN_TILE,
    pacmanFacing: Direction.Right,
    blinkyTile: { col: 1, row: 1 },
    mode,
  };
}

describe('targetFor', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: dispatch is a pure function of two enumerated fields. A unit
   *   states it in one line per branch; anything more expensive would need a
   *   whole GameState per branch and would re-test the personalities as a side
   *   effect.
   * MEASURES: that in scatter mode every ghost returns its OWN corner, and that
   *   Pac-Man's position at (7,20) is ignored entirely — two ghosts, two
   *   different corners, from one context.
   * ORACLE: docs/ARCADE-REFERENCE.md — during a scatter wave each ghost heads
   *   for its own fixed corner; personality applies to chase only. Blinky's is
   *   the top-right corner (25,0) and Clyde's the bottom-left (0,30).
   * CATCHES: scatter implemented as "chase, but toward a corner-ish tile", or
   *   one shared corner for all four. The four scatter routes collapse onto one
   *   another, the ghosts clump, and the predictable scatter window a player
   *   relies on stops existing.
   * LOAD-BEARING: yes — the stub returns {col: 0, row: 0} for both.
   */
  it("returns the ghost's own scatter corner in scatter mode, ignoring pac-man", () => {
    const scatter = contextIn('scatter');

    expect(targetFor(ghost(GhostId.Blinky, GhostPhase.Hunting), scatter)).toEqual(BLINKY_CORNER);
    expect(targetFor(ghost(GhostId.Clyde, GhostPhase.Hunting), scatter)).toEqual(CLYDE_CORNER);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: as above — the cheapest thing that can state a branch.
   * MEASURES: that a ghost in phase Eyes, and one in phase EnteringHouse, both
   *   return ctx.maze.houseDoorTile — Eyes while the mode is chase, and
   *   EnteringHouse while the mode is SCATTER, so the pair together shows that
   *   phase is consulted BEFORE mode and before personality.
   * ORACLE: docs/ARCADE-REFERENCE.md — an eaten ghost is reduced to eyes that
   *   navigate back to the ghost-house door irrespective of the current mode,
   *   the fright timer, or which ghost it is.
   * CATCHES: personality consulted before phase. A frightened-then-eaten
   *   Blinky's eyes chase Pac-Man instead of going home, never re-enter the
   *   house, never regenerate, and the player quietly finishes the level
   *   against three ghosts — a bug with no crash and no other failing test.
   * LOAD-BEARING: yes — the stub returns {col: 0, row: 0} and the fixture door
   *   is deliberately (21, 5).
   */
  it('sends eyes to the house door whatever the mode or the personality', () => {
    expect(targetFor(ghost(GhostId.Blinky, GhostPhase.Eyes), contextIn('chase'))).toEqual(
      HOUSE_DOOR,
    );
    expect(targetFor(ghost(GhostId.Pinky, GhostPhase.EnteringHouse), contextIn('scatter'))).toEqual(
      HOUSE_DOOR,
    );
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: one delegation, asserted with the personality whose rule is
   *   the identity — Blinky's. Choosing Blinky is deliberate: any other ghost
   *   would force this test to restate arithmetic that pinky.test.ts,
   *   inky.test.ts and clyde.test.ts already own, and duplicated expectations
   *   are how a suite becomes expensive to change.
   * MEASURES: that a hunting ghost in chase mode gets the personality's answer
   *   — Pac-Man's tile (7,20) for Blinky — rather than a corner or a door.
   * ORACLE: docs/ARCADE-REFERENCE.md — in chase, each ghost uses its own target
   *   rule; Blinky's is Pac-Man's current tile.
   * CATCHES: a dispatch that falls through to a default (the corner, or the
   *   door, or a hard-coded tile) for the ordinary case. Every ghost would then
   *   behave identically in chase and the entire personality system — the most
   *   distinctive thing about this game — would be dead code that every unit
   *   test still covers.
   * LOAD-BEARING: yes — the stub returns {col: 0, row: 0}.
   */
  it('delegates to the personality when a ghost is hunting in chase mode', () => {
    expect(targetFor(ghost(GhostId.Blinky, GhostPhase.Hunting), contextIn('chase'))).toEqual(
      PACMAN_TILE,
    );
  });
});
