import { Direction, opposite } from '../geometry/direction.ts';
import { squaredDistance } from '../geometry/tile-distance.ts';
import { type Tile } from '../geometry/tile.ts';
import { type Maze, isNoUpTile, walkableNeighbours } from '../maze/maze.ts';

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
 * The whole of ghost movement: one tile, one decision, no path-finder.
 *
 * Three shapes in the body are load-bearing and none of them is a matter of
 * taste.
 *
 * THE DISTANCE IS MEASURED FROM EACH CANDIDATE NEIGHBOUR, never from the
 * ghost's own tile. Measured from the ghost every candidate scores identically,
 * every decision falls through to the tie-break, and all four personalities
 * walk the same route while every test in `targeting/` still passes.
 *
 * THE COMPARISON IS STRICTLY `<`, which is what makes the tie-break free. The
 * candidates arrive from `walkableNeighbours` in `ALL_DIRECTIONS` order, so a
 * later candidate only displaces an earlier one when it is genuinely nearer —
 * exactly the ROM's own loop, and the reason `right` can never win a tie. No
 * sort, no comparator, no second source of truth about the order.
 *
 * THE TWO PROHIBITIONS ARE A PREFERENCE, NOT A LAW. Dropping the reversal and
 * dropping `up` out of a no-up tile can between them leave nothing at all —
 * a dead-end pocket, of which the real board has several near the house — and
 * there the dropped exits come back rather than the function throwing mid-frame
 * (docs/ARCADE-REFERENCE.md section 9.1).
 *
 * `reduce` without a seed is deliberate: the seed would have to be a candidate,
 * and there is no honest candidate to invent for a tile with no exits at all.
 * A ghost standing on such a tile is a broken maze, not a case to handle.
 */
export function chooseDirection(turn: GhostTurn): Direction {
  const { maze, tile, target } = turn;

  const exits = walkableNeighbours(maze, tile, turn.mayPassDoor);
  const reversal = opposite(turn.facing);
  const noUp = isNoUpTile(maze, tile);

  const preferred = exits.filter(
    (exit) => exit.direction !== reversal && !(noUp && exit.direction === Direction.Up),
  );
  const candidates = preferred.length > 0 ? preferred : exits;

  const best = candidates.reduce((nearest, candidate) =>
    squaredDistance(candidate.tile, target) < squaredDistance(nearest.tile, target)
      ? candidate
      : nearest,
  );

  return best.direction;
}
