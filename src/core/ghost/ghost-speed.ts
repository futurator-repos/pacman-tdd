import { speedSubPixels } from '../actor/speed.ts';
import { TileKind } from '../maze/tile-kind.ts';
import { type LevelSpec } from '../rules/level-spec.ts';

import { type Ghost, GhostPhase, isFrightened } from './ghost.ts';

/**
 * Which speed row applies to this ghost, this frame.
 *
 * A `TileKind` rather than a `Maze` plus a position, on purpose: the rule is a
 * SELECTION over a record, and handing it the board would drag maze parsing and
 * pixel arithmetic into a test whose only question is "which of five numbers".
 * The caller already holds the maze and `kindAt` is total, so composing them is
 * the ghost system's job (slice s11).
 *
 * docs/ARCADE-REFERENCE.md section 11, "Ghost speed selection".
 */
export interface GhostSpeedInput {
  readonly ghost: Ghost;
  readonly spec: LevelSpec;
  /** The kind of tile the ghost currently occupies. */
  readonly tileKind: TileKind;
}

/**
 * The one number in this module that is ours rather than the arcade's.
 *
 * Table A.1 publishes no eyes speed, so 150% is a repo convention
 * (docs/ARCADE-REFERENCE.md section 11.2), chosen so that eyes are strictly
 * faster than every living actor at every level — the fastest fraction anywhere
 * else is Cruise Elroy 2 at 1.05. It is a named constant rather than a literal
 * inside the selection because it is the one row a reader should be able to
 * find and argue with.
 */
const EYES_SPEED = 1.5;

/**
 * Which of the five fractions applies, read top to bottom.
 *
 * The ORDER is the whole content of this function and it is where the bugs are
 * (docs/ARCADE-REFERENCE.md section 11.1). Eyes beat everything including the
 * tunnel, or an eaten ghost crawls home at 40% and is missing for a whole fright
 * period. The tunnel beats fright and Elroy, because the tunnel carries the
 * slowest number in the table and the tunnel mouths are where a player corners a
 * blue ghost. Fright beats Elroy, because a frightened Blinky is a frightened
 * ghost first: blue, edible and slow.
 *
 * Stage 2 is tested before stage 1 so the two comparisons are equalities on the
 * one field rather than a range, which keeps "0 means off" true by construction.
 */
function speedFraction(ghost: Ghost, spec: LevelSpec, tileKind: TileKind): number {
  if (ghost.phase === GhostPhase.Eyes) {
    return EYES_SPEED;
  }
  if (tileKind === TileKind.Tunnel) {
    return spec.ghostTunnelSpeed;
  }
  if (isFrightened(ghost)) {
    return spec.ghostFrightSpeed;
  }
  if (ghost.elroyStage === 2) {
    return spec.elroy2Speed;
  }
  if (ghost.elroyStage === 1) {
    return spec.elroy1Speed;
  }
  return spec.ghostSpeed;
}

/**
 * This ghost's step for this frame, in whole sub-pixels.
 *
 * Fractions in, sub-pixels out: every caller downstream receives an integer,
 * because whole numbers are what make a ten-thousand-frame replay reproduce
 * exactly (`actor/speed.ts`). Which ghost is Cruise Elroy is deliberately NOT
 * asked here — this module reads the `elroyStage` field it is given, and
 * `elroy.ts` owns the rule that only ever sets it for Blinky.
 */
export function ghostSpeed(input: GhostSpeedInput): number {
  return speedSubPixels(speedFraction(input.ghost, input.spec, input.tileKind));
}
