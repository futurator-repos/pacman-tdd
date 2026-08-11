import { FruitKind, type LevelSpec } from './level-spec.ts';
import { wavesForLevel } from './mode-schedule.ts';

/**
 * One row of the arcade's difficulty table, which is a `LevelSpec` minus the
 * two fields that are not part of the table.
 *
 * `level` is excluded because a row is shared — levels 21 and up all read row
 * 21, and the spec still reports the level that was ASKED for. `waves` is
 * excluded because the wave schedule changes on different boundaries (1, 2-4,
 * 5+) than the difficulty rows do, so `mode-schedule.ts` owns it and this table
 * would only duplicate it.
 */
type LevelRow = Omit<LevelSpec, 'level' | 'waves'>;

/**
 * docs/ARCADE-REFERENCE.md section 3, transcribed complete: 21 rows, and
 * nothing beyond them.
 *
 * Keyed by level number rather than stored as an array so the lookup is total
 * WITHOUT an unreachable fallback. A `readonly LevelRow[]` would be
 * `LevelRow | undefined` at every index under `noUncheckedIndexedAccess`,
 * forcing a `?? someRow` that the clamp guarantees can never run — and a branch
 * no test can reach is a branch that should not exist.
 *
 * The rows below levels 17, 19, 20 and 21 carry frightened speeds even though
 * their fright lasts zero frames. The reference document records that as a
 * representation choice, not an arcade fact: `LevelSpec` has no optional
 * fields, so the columns the table prints as `—` keep the last values that were
 * actually used.
 */
const LEVEL_ROWS = {
  1: {
    pacmanSpeed: 0.8,
    pacmanDotSpeed: 0.71,
    pacmanFrightSpeed: 0.9,
    pacmanFrightDotSpeed: 0.79,
    ghostSpeed: 0.75,
    ghostTunnelSpeed: 0.4,
    ghostFrightSpeed: 0.5,
    elroy1DotsLeft: 20,
    elroy1Speed: 0.8,
    elroy2DotsLeft: 10,
    elroy2Speed: 0.85,
    frightenedFrames: 360, // 6 s
    frightenedFlashes: 5,
    fruit: FruitKind.Cherry,
    fruitPoints: 100,
  },
  2: {
    pacmanSpeed: 0.9,
    pacmanDotSpeed: 0.79,
    pacmanFrightSpeed: 0.95,
    pacmanFrightDotSpeed: 0.83,
    ghostSpeed: 0.85,
    ghostTunnelSpeed: 0.45,
    ghostFrightSpeed: 0.55,
    elroy1DotsLeft: 30,
    elroy1Speed: 0.9,
    elroy2DotsLeft: 15,
    elroy2Speed: 0.95,
    frightenedFrames: 300, // 5 s
    frightenedFlashes: 5,
    fruit: FruitKind.Strawberry,
    fruitPoints: 300,
  },
  3: {
    pacmanSpeed: 0.9,
    pacmanDotSpeed: 0.79,
    pacmanFrightSpeed: 0.95,
    pacmanFrightDotSpeed: 0.83,
    ghostSpeed: 0.85,
    ghostTunnelSpeed: 0.45,
    ghostFrightSpeed: 0.55,
    elroy1DotsLeft: 40,
    elroy1Speed: 0.9,
    elroy2DotsLeft: 20,
    elroy2Speed: 0.95,
    frightenedFrames: 240, // 4 s
    frightenedFlashes: 5,
    fruit: FruitKind.Orange,
    fruitPoints: 500,
  },
  4: {
    pacmanSpeed: 0.9,
    pacmanDotSpeed: 0.79,
    pacmanFrightSpeed: 0.95,
    pacmanFrightDotSpeed: 0.83,
    ghostSpeed: 0.85,
    ghostTunnelSpeed: 0.45,
    ghostFrightSpeed: 0.55,
    elroy1DotsLeft: 40,
    elroy1Speed: 0.9,
    elroy2DotsLeft: 20,
    elroy2Speed: 0.95,
    frightenedFrames: 180, // 3 s
    frightenedFlashes: 5,
    fruit: FruitKind.Orange,
    fruitPoints: 500,
  },
  5: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 40,
    elroy1Speed: 1,
    elroy2DotsLeft: 20,
    elroy2Speed: 1.05,
    frightenedFrames: 120, // 2 s
    frightenedFlashes: 5,
    fruit: FruitKind.Apple,
    fruitPoints: 700,
  },
  6: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 50,
    elroy1Speed: 1,
    elroy2DotsLeft: 25,
    elroy2Speed: 1.05,
    frightenedFrames: 300, // 5 s
    frightenedFlashes: 5,
    fruit: FruitKind.Apple,
    fruitPoints: 700,
  },
  7: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 50,
    elroy1Speed: 1,
    elroy2DotsLeft: 25,
    elroy2Speed: 1.05,
    frightenedFrames: 120, // 2 s
    frightenedFlashes: 5,
    fruit: FruitKind.Melon,
    fruitPoints: 1000,
  },
  8: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 50,
    elroy1Speed: 1,
    elroy2DotsLeft: 25,
    elroy2Speed: 1.05,
    frightenedFrames: 120, // 2 s
    frightenedFlashes: 5,
    fruit: FruitKind.Melon,
    fruitPoints: 1000,
  },
  9: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 60,
    elroy1Speed: 1,
    elroy2DotsLeft: 30,
    elroy2Speed: 1.05,
    frightenedFrames: 60, // 1 s
    frightenedFlashes: 3,
    fruit: FruitKind.Galaxian,
    fruitPoints: 2000,
  },
  10: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 60,
    elroy1Speed: 1,
    elroy2DotsLeft: 30,
    elroy2Speed: 1.05,
    frightenedFrames: 300, // 5 s
    frightenedFlashes: 5,
    fruit: FruitKind.Galaxian,
    fruitPoints: 2000,
  },
  11: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 60,
    elroy1Speed: 1,
    elroy2DotsLeft: 30,
    elroy2Speed: 1.05,
    frightenedFrames: 120, // 2 s
    frightenedFlashes: 5,
    fruit: FruitKind.Bell,
    fruitPoints: 3000,
  },
  12: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 80,
    elroy1Speed: 1,
    elroy2DotsLeft: 40,
    elroy2Speed: 1.05,
    frightenedFrames: 60, // 1 s
    frightenedFlashes: 3,
    fruit: FruitKind.Bell,
    fruitPoints: 3000,
  },
  13: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 80,
    elroy1Speed: 1,
    elroy2DotsLeft: 40,
    elroy2Speed: 1.05,
    frightenedFrames: 60, // 1 s
    frightenedFlashes: 3,
    fruit: FruitKind.Key,
    fruitPoints: 5000,
  },
  14: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 80,
    elroy1Speed: 1,
    elroy2DotsLeft: 40,
    elroy2Speed: 1.05,
    frightenedFrames: 180, // 3 s
    frightenedFlashes: 5,
    fruit: FruitKind.Key,
    fruitPoints: 5000,
  },
  15: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 100,
    elroy1Speed: 1,
    elroy2DotsLeft: 50,
    elroy2Speed: 1.05,
    frightenedFrames: 60, // 1 s
    frightenedFlashes: 3,
    fruit: FruitKind.Key,
    fruitPoints: 5000,
  },
  16: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 100,
    elroy1Speed: 1,
    elroy2DotsLeft: 50,
    elroy2Speed: 1.05,
    frightenedFrames: 60, // 1 s
    frightenedFlashes: 3,
    fruit: FruitKind.Key,
    fruitPoints: 5000,
  },
  /* Not a typo: fright vanishes at 17, comes BACK for one second at 18, and is
     gone for good from 19. The document says the curve is non-monotonic here. */
  17: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 100,
    elroy1Speed: 1,
    elroy2DotsLeft: 50,
    elroy2Speed: 1.05,
    frightenedFrames: 0,
    frightenedFlashes: 0,
    fruit: FruitKind.Key,
    fruitPoints: 5000,
  },
  18: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 100,
    elroy1Speed: 1,
    elroy2DotsLeft: 50,
    elroy2Speed: 1.05,
    frightenedFrames: 60, // 1 s
    frightenedFlashes: 3,
    fruit: FruitKind.Key,
    fruitPoints: 5000,
  },
  19: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 120,
    elroy1Speed: 1,
    elroy2DotsLeft: 60,
    elroy2Speed: 1.05,
    frightenedFrames: 0,
    frightenedFlashes: 0,
    fruit: FruitKind.Key,
    fruitPoints: 5000,
  },
  20: {
    pacmanSpeed: 1,
    pacmanDotSpeed: 0.87,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 120,
    elroy1Speed: 1,
    elroy2DotsLeft: 60,
    elroy2Speed: 1.05,
    frightenedFrames: 0,
    frightenedFlashes: 0,
    fruit: FruitKind.Key,
    fruitPoints: 5000,
  },
  /* Pac-Man drops BACK to 90% while the ghosts stay at 95%: he is slower than
     they are, forever. The original's final answer to a good player. */
  21: {
    pacmanSpeed: 0.9,
    pacmanDotSpeed: 0.79,
    pacmanFrightSpeed: 1,
    pacmanFrightDotSpeed: 0.87,
    ghostSpeed: 0.95,
    ghostTunnelSpeed: 0.5,
    ghostFrightSpeed: 0.6,
    elroy1DotsLeft: 120,
    elroy1Speed: 1,
    elroy2DotsLeft: 60,
    elroy2Speed: 1.05,
    frightenedFrames: 0,
    frightenedFlashes: 0,
    fruit: FruitKind.Key,
    fruitPoints: 5000,
  },
} as const satisfies Readonly<Record<number, LevelRow>>;

/** The levels the table actually has a row for: 1 to 21, and nothing else. */
type TableLevel = keyof typeof LEVEL_ROWS;

const FIRST_TABLE_LEVEL = 1;
const LAST_TABLE_LEVEL = 21;

/**
 * Fold any level number onto a row that exists.
 *
 * Both clamps are repo decisions rather than arcade facts. The upper one is:
 * the original board has 21 rows and reuses the last one forever, so this is
 * the single place `Math.min(level, 21)` is ever written. The lower one exists
 * so that a caller asking about level 0 — `startGame` does, before the first
 * frame — gets a playable row instead of a crash.
 *
 * The assertion is deliberate and it is doing real work: `Math.min`/`Math.max`
 * return `number`, so nothing but this line can tell the compiler the result is
 * one of the 21 keys. The alternative — an array index plus a `?? fallbackRow`
 * — would add a branch that the clamp makes unreachable, and an unreachable
 * branch is exactly what the coverage gate forbids.
 */
function tableLevel(level: number): TableLevel {
  return Math.min(Math.max(level, FIRST_TABLE_LEVEL), LAST_TABLE_LEVEL) as TableLevel;
}

/**
 * The arcade's difficulty row for a level.
 *
 * Total: levels 21 and up share row 21, levels below 1 share row 1, and the
 * clamp lives here so no other module ever writes `Math.min(level, 21)`.
 * Every number comes from docs/ARCADE-REFERENCE.md section 3.
 *
 * `level` reports the level that was ASKED for, not the row that answered it —
 * so a HUD reading `spec.level` shows "24" on level 24 while every rule reads
 * row 21's numbers. The waves come from `mode-schedule.ts` for the same clamped
 * level, because the two tables are looked up on different boundaries and only
 * one module should know either set.
 */
export function levelSpec(level: number): LevelSpec {
  const row = tableLevel(level);
  return { level, ...LEVEL_ROWS[row], waves: wavesForLevel(row) };
}
