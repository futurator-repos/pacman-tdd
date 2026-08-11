/**
 * The one place an arcade speed percentage becomes an integer.
 *
 * The original states every actor's speed as a percentage of "full speed" —
 * 80% for level-1 Pac-Man, 75% for the ghosts, 40% for a ghost in the tunnel
 * (docs/ARCADE-REFERENCE.md section 3). Nothing else in the game may multiply
 * by a percentage: everything downstream receives whole sub-pixels per frame,
 * because whole numbers are what make a ten-thousand-frame replay reproduce
 * exactly.
 */
import { SUBPIXELS_PER_PIXEL } from './actor.ts';

/**
 * The arcade's 100% speed, in sub-pixels per frame.
 *
 * Derived in docs/ARCADE-REFERENCE.md section 2: the Dossier's 75.75757625
 * pixels/sec over the board's 60.606061 frames/sec is 1.25 pixels per frame,
 * and a pixel is `SUBPIXELS_PER_PIXEL` sub-pixels.
 *
 * Note that this is NOT `SUBPIXELS_PER_PIXEL`, and the conflation is the easy
 * mistake: 256 is how finely a PIXEL is divided, 320 is how far a 100% actor
 * travels in a FRAME. The independent check is visible in the original game —
 * level-1 Pac-Man at 80% advances exactly one pixel per frame, and
 * 0.8 * 320 = 256 sub-pixels is exactly one pixel.
 */
export const FULL_SPEED = 1.25 * SUBPIXELS_PER_PIXEL;

/**
 * An arcade speed percentage as a whole number of sub-pixels per frame.
 *
 * Rounded to nearest rather than floored, so the two level-1 fractions that do
 * not divide exactly land on the nearest achievable step instead of drifting
 * systematically slow. Whole, because the sub-pixel carry is integer
 * arithmetic: a float here would accumulate error and a long replay would
 * desynchronise from the run it claims to reproduce.
 *
 * Deliberately unclamped and with no minimum: a ghost's eyes travel home above
 * 100%, and an actor frozen in its post-pellet pause really does have a step of
 * zero.
 */
export function speedSubPixels(fraction: number): number {
  return Math.round(fraction * FULL_SPEED);
}
