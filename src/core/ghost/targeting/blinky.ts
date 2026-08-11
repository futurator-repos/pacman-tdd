import type { GhostTargeter } from './target-context.ts';

/**
 * Blinky ("Shadow") chases with an offset of exactly (0, 0).
 *
 * The identity rule is worth its own file rather than an inline arrow at the
 * dispatch table: the four personalities differ ONLY in this function, so
 * keeping all four the same shape is what lets a reader compare them by
 * reading four short files instead of one branching one. He never reads the
 * facing — that is Pinky's and Inky's input — and never reads his own tile,
 * which only Clyde does. docs/ARCADE-REFERENCE.md section 6.2.
 */
export const blinkyTarget: GhostTargeter = (_ghost, ctx) => ctx.pacmanTile;
