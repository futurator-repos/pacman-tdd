/**
 * SIGNATURE-ONLY STUB — RED phase.
 *
 * `GhostId` itself is declared in full because it is the type LAYER, not
 * behaviour: `Readonly<Record<GhostId, Tile>>` in `Maze` cannot be written
 * without it, and a const object of four string literals asserts nothing.
 * `GHOST_ORDER` is the behaviour — the one sequence four different subsystems
 * agree on — so it is stubbed to `[]` and `ghost-id.test.ts` fails on it.
 *
 * The rule that keeps this honest: the stub must not make a single assertion
 * pass that ought to be failing. See docs/TDD-FINDINGS.md.
 */

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
 * STUB — the real order is pinned by `ghost-id.test.ts`.
 *
 * One array, four jobs. Release order, collision-check order, Rng-consumption
 * order and draw order are ALL this order, and they have to be the same order
 * or a replay stops reproducing: if the ghosts consume the seeded Rng stream in
 * a different sequence, every frightened turn after that point differs.
 */
export const GHOST_ORDER: readonly GhostId[] = [];
