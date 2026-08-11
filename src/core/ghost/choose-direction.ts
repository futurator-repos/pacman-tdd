import { Direction } from '../geometry/direction.ts';
import { type Tile } from '../geometry/tile.ts';
import { type Maze } from '../maze/maze.ts';

/**
 * Everything the turn decision is allowed to know.
 *
 * A closed record rather than four positional arguments, and deliberately
 * WITHOUT the ghost: `choose-direction.ts` decides which way to leave a tile,
 * and it must not be able to consult the ghost's identity, its phase or its
 * fright timer. Those belong to the caller — a frightened ghost is routed by
 * `frightened-turn.ts` instead, and which of the two runs is the ghost
 * system's decision (slice s11), not this module's.
 *
 * `target` is a plain `Tile` for the same reason: the four personalities in
 * `targeting/` have already collapsed to one tile by the time this runs, so
 * Pinky's overflow bug can never be re-litigated here.
 *
 * docs/ARCADE-REFERENCE.md section 9, "The turn decision".
 */
export interface GhostTurn {
  readonly maze: Maze;
  /** The tile the ghost is standing on, at its centre. */
  readonly tile: Tile;
  readonly facing: Direction;
  /** Where the ghost wants to be. May be a wall, and may be off the board. */
  readonly target: Tile;
  /** Ghosts cross the house gate; the flag exists because Pac-Man cannot. */
  readonly mayPassDoor: boolean;
}

/**
 * SIGNATURE-ONLY STUB — no behaviour. See docs/TDD-CHARTER.md, challenge 1.
 *
 * The inert value is `Direction.Right` and the choice is not arbitrary. The
 * return type is a four-value union, so SOME direction has to come back and
 * every candidate risks making a real assertion pass by coincidence — the one
 * thing a stub may never do. `Right` is the safest of the four because it is
 * the direction the arcade rule produces least: it is last in `ALL_DIRECTIONS`,
 * so it can never win a distance tie (docs/ARCADE-REFERENCE.md section 9), and
 * no test in `choose-direction.test.ts` expects it.
 */
export function chooseDirection(_turn: GhostTurn): Direction {
  return Direction.Right;
}
