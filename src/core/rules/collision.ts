/**
 * Pac-Man meets a ghost: one tile comparison, three outcomes.
 *
 * The arcade decides this by tile occupancy and nothing else
 * (docs/ARCADE-REFERENCE.md section 13.5), which is why this is a pure function
 * of a tile and a ghost rather than something that reaches into the game state.
 * It takes a `Tile` rather than a `Pacman` on purpose: the only thing about
 * Pac-Man that matters here is which tile he is standing in, and depending on
 * the wider record would couple the most important rule in the game to a type
 * that has nothing to do with it.
 *
 * The rule runs TWICE per frame in the finished pipeline — once after Pac-Man
 * moves and once after the ghosts move — which is what reproduces the arcade's
 * pass-through. That it is a pure function of two arguments is what makes
 * running it twice harmless.
 */
import { tileAt, tileEquals, type Tile } from '../geometry/tile.ts';
import { GhostPhase, isFrightened, type Ghost } from '../ghost/ghost.ts';

/**
 * The three things that can happen, as a closed set of names.
 *
 * A const object rather than an enum (`erasableSyntaxOnly`), and three names
 * rather than a boolean, because "did they collide" is the wrong question: the
 * interesting answer is WHICH of them was eaten.
 */
export const CollisionOutcome = {
  Nothing: 'nothing',
  GhostEaten: 'eaten',
  PacmanCaught: 'caught',
} as const;

export type CollisionOutcome = (typeof CollisionOutcome)[keyof typeof CollisionOutcome];

/**
 * Decide what a ghost and a tile amount to this frame.
 *
 * The phase test comes FIRST and that ordering is the rule, not a style
 * choice: `isFrightened` reads the global timer and nothing else (section 6.6),
 * so an eaten ghost on its way home still answers true, and asking it before
 * the phase would let the player re-eat the same pair of eyes for another 1600
 * points every frame until they reached the door.
 *
 * The comparison is `tileAt(...)` against a whole tile rather than a distance
 * between two pixels. A radius cannot express this rule: `centreOf` puts a tile's
 * centre at `col * 8 + 4`, so the tile's own first pixel is four away and inside
 * while the next tile's first pixel is four away and outside.
 */
export function resolveCollision(pacmanTile: Tile, ghost: Ghost): CollisionOutcome {
  if (ghost.phase === GhostPhase.Eyes || ghost.phase === GhostPhase.EnteringHouse) {
    return CollisionOutcome.Nothing;
  }

  if (!tileEquals(tileAt(ghost.actor.position), pacmanTile)) {
    return CollisionOutcome.Nothing;
  }

  return isFrightened(ghost) ? CollisionOutcome.GhostEaten : CollisionOutcome.PacmanCaught;
}
