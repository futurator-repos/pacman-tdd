import { FruitKind, type LevelSpec } from './level-spec.ts';

/**
 * SIGNATURE-ONLY STUB — slice s04, RED phase. No behaviour, no table.
 *
 * `INERT_SPEC` is zeros throughout. `fruit` has no zero, so it takes the first
 * member of `FruitKind`; that happens to be level 1's real fruit, which means
 * one assertion in the level-1 row test passes against this stub. That is
 * reported rather than dodged — picking `Key` here purely to redden a test
 * would be the stub telling the tests what to say, which is the one thing a
 * stub must never do. The test as a whole still fails on fifteen other fields.
 */
const INERT_SPEC: LevelSpec = {
  level: 0,
  pacmanSpeed: 0,
  pacmanDotSpeed: 0,
  pacmanFrightSpeed: 0,
  pacmanFrightDotSpeed: 0,
  ghostSpeed: 0,
  ghostTunnelSpeed: 0,
  ghostFrightSpeed: 0,
  elroy1DotsLeft: 0,
  elroy1Speed: 0,
  elroy2DotsLeft: 0,
  elroy2Speed: 0,
  frightenedFrames: 0,
  frightenedFlashes: 0,
  fruit: FruitKind.Cherry,
  fruitPoints: 0,
  waves: [],
};

/**
 * The arcade's difficulty row for a level.
 *
 * Total: levels 21 and up share row 21, levels below 1 share row 1, and the
 * clamp lives here so no other module ever writes `Math.min(level, 21)`.
 * Every number comes from docs/ARCADE-REFERENCE.md section 3.
 */
export function levelSpec(_level: number): LevelSpec {
  return INERT_SPEC;
}
