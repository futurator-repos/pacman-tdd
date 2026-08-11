/**
 * The ghost-scoring ladder, and the one question everybody gets wrong: when
 * does it go back to 200?
 *
 * The whole module is arithmetic over a single integer — how many ghosts have
 * been eaten during the CURRENT fright. It owns no state. The count itself is
 * threaded through `GameState` by slice s09 and updated by the collision and
 * mode systems in slice s11; keeping the RULE separate from the STORAGE is what
 * lets the 3000-point chain be tested in four function calls instead of by
 * playing a level.
 */
import { GHOST_POINTS } from './points.ts';

/**
 * The top of the ladder, read off the ladder itself.
 *
 * Written as `GHOST_POINTS[3]` rather than as the literal 1600 so that the cap
 * cannot drift away from the table it caps: change the last rung and the cap
 * follows. The literal index is what makes it `number` rather than
 * `number | undefined` — see the tuple type in `points.ts`.
 */
const LADDER_CAP = GHOST_POINTS[3];

/**
 * What the next ghost eaten is worth, given how many have already been eaten
 * during this fright. docs/ARCADE-REFERENCE.md section 13.2.
 *
 * Total by construction: the game cannot produce a fifth ghost in one fright,
 * but the type system permits the input, so the function answers with the 1600
 * cap rather than reading off the end of the ladder. An `undefined` here would
 * reach `addScore` and turn the score into `NaN` for the rest of the game.
 */
export function ghostPoints(eatenThisFright: number): number {
  return GHOST_POINTS[eatenThisFright] ?? LADDER_CAP;
}

/**
 * The chain after a ghost has been eaten.
 *
 * It climbs. Eating a ghost is what ADVANCES the ladder, never what resets it —
 * "each additional ghost is worth twice as many points as the one before it".
 */
export function chainAfterGhostEaten(eatenThisFright: number): number {
  return eatenThisFright + 1;
}

/**
 * The chain to carry into the fright a power pellet has just started.
 *
 * This is the whole subtlety of section 13.2, expressed as one function so it can
 * be one assertion. The ladder resets when the fright period ENDS, so a power
 * pellet taken while the ghosts are still blue extends that period and leaves
 * the ladder where it is; a power pellet taken with no fright running begins a
 * new one at the first rung.
 *
 * `frightenedFramesLeft` is read from the wave clock BEFORE the pellet refreshes
 * it — that ordering is the whole meaning of the argument, and it is why this is
 * a function of two numbers rather than one.
 */
export function chainAfterPowerPellet(
  eatenThisFright: number,
  frightenedFramesLeft: number,
): number {
  return frightenedFramesLeft > 0 ? eatenThisFright : 0;
}
