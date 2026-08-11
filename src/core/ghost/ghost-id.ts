/**
 * The four ghosts, by their arcade names.
 *
 * A const object rather than an enum: `erasableSyntaxOnly` is on, so the type
 * layer must vanish completely at build time.
 *
 * This module is a LEAF — it imports nothing at all. That is deliberate: it
 * lets `maze.ts` key ghost spawns and scatter targets by ghost without an
 * import cycle between the maze and the ghosts that walk it.
 */
export const GhostId = {
  Blinky: 'blinky',
  Pinky: 'pinky',
  Inky: 'inky',
  Clyde: 'clyde',
} as const;

export type GhostId = (typeof GhostId)[keyof typeof GhostId];

/**
 * One array, four jobs.
 *
 * Release order, collision-check order, Rng-consumption order and draw order
 * are ALL this order, and they have to be the same order or a replay stops
 * reproducing: if the ghosts consume the seeded Rng stream in a different
 * sequence, every frightened turn after that point differs.
 *
 * Written out as four literals rather than derived from `Object.values(GhostId)`
 * on purpose. Key order is a property of how the object above happens to be
 * typed, not a decision anybody made — and a determinism contract should be a
 * decision somebody made.
 */
export const GHOST_ORDER: readonly GhostId[] = [
  GhostId.Blinky,
  GhostId.Pinky,
  GhostId.Inky,
  GhostId.Clyde,
];
