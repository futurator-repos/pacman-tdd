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
 *
 * STUB (slice s08 RED): always reports nothing. Two of this rule's tests are
 * guards that a do-nothing stub satisfies; they are labelled as such, and they
 * sit beside the one it cannot satisfy.
 */
import { type Tile } from '../geometry/tile.ts';
import { type Ghost } from '../ghost/ghost.ts';

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

export function resolveCollision(_pacmanTile: Tile, _ghost: Ghost): CollisionOutcome {
  return CollisionOutcome.Nothing;
}
