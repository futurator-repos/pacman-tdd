import { describe, expect, it } from 'vitest';

import { Direction } from '../geometry/direction.ts';
import { centreOf, type Tile } from '../geometry/tile.ts';
import { type Vector2 } from '../geometry/vector.ts';
import { GhostId } from '../ghost/ghost-id.ts';
import { GhostPhase, type Ghost } from '../ghost/ghost.ts';

import { CollisionOutcome, resolveCollision } from './collision.ts';

/**
 * Pac-Man meets a ghost.
 *
 * The whole rule is one sentence, quoted verbatim in
 * docs/ARCADE-REFERENCE.md section 13.5:
 *
 *   "Any time Pac-Man occupies the same tile as a ghost, he is considered to
 *    have collided with that ghost and a life is lost."
 *
 * Tiles, not pixels. Once per frame, after everything has moved. Three outcomes,
 * and the third — eyes pass through — is this codebase's documented divergence
 * from its own `isFrightened` predicate, recorded in section 6.6: fright is a
 * global timer rather than a per-ghost phase, so an eaten ghost still reads as
 * frightened and the collision rule is the one place that has to know better.
 *
 * Every ghost below is built by hand, at a named tile, with the two fields that
 * matter set explicitly. No maze, no movement, no game state: if this file ever
 * needs a maze to make its point, the rule has stopped being a rule.
 */

/** The tile Pac-Man stands on in every test here. Any tile would do. */
const PACMAN_TILE: Tile = { col: 5, row: 5 };

/**
 * A ghost at an exact pixel, with everything irrelevant to collision set to a
 * neutral value.
 *
 * Taking a pixel rather than a tile is what lets the "one pixel outside" test
 * below exist at all — the entire question there is whether the rule rounds to a
 * tile or measures a distance.
 */
function ghostAtPixel(position: Vector2, phase: GhostPhase, frightenedFramesLeft: number): Ghost {
  return {
    id: GhostId.Blinky,
    actor: { position, facing: Direction.Left, queued: null, carrySubPixels: 0 },
    phase,
    frightenedFramesLeft,
    dotCounter: 0,
    dotCounterActive: false,
    elroyStage: 0,
    reverseQueued: false,
  };
}

/** A ghost standing on the centre pixel of a tile. */
function ghostOn(tile: Tile, phase: GhostPhase, frightenedFramesLeft: number): Ghost {
  return ghostAtPixel(centreOf(tile), phase, frightenedFramesLeft);
}

describe('resolveCollision', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: The resolution rule alone, with the ghost and Pac-Man placed
   *   on the same tile by hand. Keeping it a unit means the scoring ladder and
   *   the event emission — both tested at system level in slice s11 — cannot mask
   *   a fault in the rule itself, and a failure here names the rule rather than
   *   the frame it happened on.
   * MEASURES: The two outcomes that matter, on identical tiles, distinguished by
   *   the fright timer alone — including the exact frame the timer reaches zero.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.5: same tile plus fright timer
   *   running is a ghost eaten; same tile with the timer at zero is a life lost.
   *   The zero case is section 6.6's "strictly greater than zero" made
   *   observable: on the frame fright ends the ghost is dangerous again, not one
   *   frame later.
   * CATCHES: The two outcomes swapped, or fright read from a phase that does not
   *   exist. Power pellets then become a death sentence — the most
   *   player-visible bug this codebase could ship — and a unit catches it in a
   *   millisecond.
   * LOAD-BEARING: yes (the stub reports nothing for both).
   */
  it('eats a frightened ghost on pac-man tile and lets a hunting one catch him', () => {
    expect.assertions(3);

    const blue = ghostOn(PACMAN_TILE, GhostPhase.Hunting, 120);
    const hunting = ghostOn(PACMAN_TILE, GhostPhase.Hunting, 0);

    expect(resolveCollision(PACMAN_TILE, blue)).toBe(CollisionOutcome.GhostEaten);
    expect(resolveCollision(PACMAN_TILE, hunting)).toBe(CollisionOutcome.PacmanCaught);

    /* One frame of fright left is still fright: the ghost is edible right up to
       the frame the timer empties. */
    expect(resolveCollision(PACMAN_TILE, ghostOn(PACMAN_TILE, GhostPhase.Hunting, 1))).toBe(
      CollisionOutcome.GhostEaten,
    );
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A third branch of the same pure rule, given its own name so
   *   the exemption reads as documented behaviour rather than as an unexplained
   *   condition somebody later "tidies away".
   * MEASURES: A ghost heading home on Pac-Man's tile — in both of the phases that
   *   means — resolves to nothing, WHILE THE FRIGHT TIMER IS STILL RUNNING.
   * ORACLE: docs/ARCADE-REFERENCE.md sections 13.5 and 6.6: a pair of eyes is
   *   neither blue nor edible, and because `isFrightened` deliberately returns
   *   true for any phase while the timer runs, the exception lives here.
   * CATCHES: Eyes treated as a hunting ghost, killing Pac-Man on the way home —
   *   or as a frightened one, letting the player re-eat the same eyes for another
   *   1600 points all the way to the door.
   *
   *   The fixture is the point of this test. The timer is set to 120 rather than
   *   0 precisely so that an implementation asking `isFrightened(ghost)` FIRST
   *   would answer "eaten" and fail here. With the timer at zero the test would
   *   pass against that implementation and prove nothing at all.
   * LOAD-BEARING: no — the stub reports nothing for everything, so this passes at
   *   RED. It is a GUARD, and it only protects anything beside the load-bearing
   *   test above; the two of them together are what force the phase check.
   */
  it('lets eyes pass straight through pac-man even while the fright timer is still running', () => {
    expect.assertions(2);

    const eyes = ghostOn(PACMAN_TILE, GhostPhase.Eyes, 120);
    const arriving = ghostOn(PACMAN_TILE, GhostPhase.EnteringHouse, 120);

    expect(resolveCollision(PACMAN_TILE, eyes)).toBe(CollisionOutcome.Nothing);
    expect(resolveCollision(PACMAN_TILE, arriving)).toBe(CollisionOutcome.Nothing);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The granularity of the comparison is only visible at its
   *   boundary, and the boundary is a single pixel. Nothing but a unit can place
   *   an actor on an exact pixel and ask the question.
   * MEASURES: A frightened ghost one pixel outside Pac-Man's tile — the last
   *   pixel of the column to his left, and the first pixel of the column to his
   *   right — is not a collision.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.5: collision is decided by tile
   *   occupancy, not by pixel distance. With TILE_SIZE 8, column 5 spans x 40 to
   *   47, so x = 39 is column 4 and x = 48 is column 6 — adjacent, and not the
   *   same tile.
   * CATCHES: A rule written as a pixel-distance threshold, which is the obvious
   *   thing to reach for and gives Pac-Man a hitbox the arcade never had. Ghosts
   *   would appear to catch him "through the wall" a pixel before touching.
   *
   *   Both pixels are asserted because `centreOf` puts the centre at x = 44, so
   *   the tile is NOT symmetric about it: the left edge (x = 40) is four pixels
   *   away and still inside, while x = 48 is four pixels away and already out.
   *   This test alone cannot see the difference — it is the pair of it and
   *   "catches pac-man from the first pixel of his tile" below that traps a
   *   threshold, because no single radius satisfies both.
   * LOAD-BEARING: no — the stub reports nothing. GUARD, and its value is that it
   *   states the units the rule works in.
   */
  it('compares tiles and not pixels: a ghost one pixel outside pac-man tile is nothing', () => {
    expect.assertions(2);

    const centre = centreOf(PACMAN_TILE);
    const justLeft = ghostAtPixel(
      { x: centre.x - 5, y: centre.y },
      GhostPhase.Hunting,
      /* frightened, so a failure here cannot be blamed on the phase check */ 120,
    );
    /* x = 48: the FIRST pixel of column 6, and exactly as far from the centre as
       the tile's own left edge. */
    const justRight = ghostAtPixel({ x: centre.x + 4, y: centre.y }, GhostPhase.Hunting, 120);

    expect(resolveCollision(PACMAN_TILE, justLeft)).toBe(CollisionOutcome.Nothing);
    expect(resolveCollision(PACMAN_TILE, justRight)).toBe(CollisionOutcome.Nothing);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The other side of the boundary above, and the half that a
   *   pixel-distance implementation actually fails. Only a unit can put a ghost
   *   on a named corner pixel of a named tile.
   * MEASURES: A hunting ghost on the first pixel of Pac-Man's tile (x 40, y 40)
   *   and on its last (x 47, y 47) catches him — the whole 8x8 tile counts, not a
   *   region around its centre.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.5, quoting the Dossier: "Any time
   *   Pac-Man occupies the same tile as a ghost, he is considered to have
   *   collided with that ghost". The tile, entire. With TILE_SIZE 8 and
   *   `centreOf` at x = col*8+4, tile {5,5} spans pixels 40 to 47 in both axes.
   * CATCHES: The hitbox. A four-pixel box around Pac-Man's centre passes every
   *   other test in this file — it was tried, and it did — because every other
   *   fixture here sits either on the exact centre or outside the tile. It has to
   *   accept x = 40 (four pixels away, inside) and reject x = 48 (four pixels
   *   away, outside), and no radius does both. In play the hitbox version lets
   *   ghosts and Pac-Man overlap by three pixels with nothing happening.
   * LOAD-BEARING: yes (the stub reports nothing).
   */
  it('catches pac-man from the first pixel of his tile: the whole tile is his, not a box round his centre', () => {
    expect.assertions(2);

    const firstPixel = ghostAtPixel({ x: 40, y: 40 }, GhostPhase.Hunting, 0);
    const lastPixel = ghostAtPixel({ x: 47, y: 47 }, GhostPhase.Hunting, 0);

    expect(resolveCollision(PACMAN_TILE, firstPixel)).toBe(CollisionOutcome.PacmanCaught);
    expect(resolveCollision(PACMAN_TILE, lastPixel)).toBe(CollisionOutcome.PacmanCaught);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A tile has two coordinates and the rule has to read both. That
   *   is one call to state and unstateable anywhere else — in a running game a
   *   ghost one row above Pac-Man is an ordinary frame that nothing reports.
   * MEASURES: A hunting ghost in Pac-Man's own COLUMN, one row above him, is not
   *   a collision.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.5: the same TILE, which is a pair
   *   {col, row}. Two tiles sharing a column are different tiles.
   * CATCHES: A comparison that reads one coordinate and forgets the other. Every
   *   other fixture in this file puts the ghost on Pac-Man's own row — row 5 — so
   *   a rule comparing columns alone passes all of them; it was written and it
   *   did. Shipped, it kills Pac-Man from a ghost a tile above him, through a
   *   wall, and the player cannot see why.
   * LOAD-BEARING: no — the stub reports nothing. GUARD, and it is only worth
   *   anything beside the load-bearing same-tile test at the top of this file.
   */
  it('compares the row as well as the column: a ghost one tile above pac-man is nothing', () => {
    const oneRowUp = ghostOn(
      { col: PACMAN_TILE.col, row: PACMAN_TILE.row - 1 },
      GhostPhase.Hunting,
      0,
    );

    expect(resolveCollision(PACMAN_TILE, oneRowUp)).toBe(CollisionOutcome.Nothing);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The rule under test is that collision compares positions AFTER
   *   movement and does not interpolate the path between frames. A unit stating
   *   the before and after tiles explicitly is the clearest possible form of that
   *   claim; an integration test would depend on two speeds lining up to the
   *   pixel and would flake.
   * MEASURES: Two consecutive frames in which Pac-Man and a hunting ghost
   *   exchange adjacent tiles. Neither frame is a collision, because on neither
   *   frame do they share a tile.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.5, "the pass-through is faithful":
   *   the original compares tile occupancy once per frame, so a head-on swap at
   *   the right moment passes through. Documented original behaviour, reproduced
   *   deliberately.
   * CATCHES: Someone adding path-crossing detection to "fix the bug". Pac-Man
   *   then dies in situations the arcade let him live, and the difference is
   *   invisible until a good player notices.
   * LOAD-BEARING: no — a stub reporting no collision passes trivially. Its value
   *   is entirely in the NAME, which tells the next reviewer that this is
   *   intentional and must not be repaired.
   */
  it('never collides when pac-man and a ghost swap tiles in a single frame - faithful arcade pass-through', () => {
    expect.assertions(2);

    const left: Tile = { col: 5, row: 5 };
    const right: Tile = { col: 6, row: 5 };

    /* Frame N: Pac-Man on the left tile, the ghost on the right one. */
    expect(resolveCollision(left, ghostOn(right, GhostPhase.Hunting, 0))).toBe(
      CollisionOutcome.Nothing,
    );

    /* Frame N+1: they have walked through each other and swapped. */
    expect(resolveCollision(right, ghostOn(left, GhostPhase.Hunting, 0))).toBe(
      CollisionOutcome.Nothing,
    );
  });
});
