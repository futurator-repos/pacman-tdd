/**
 * The vocabulary of the arcade's difficulty table.
 *
 * This file is deliberately declarations only — types, plus the two closed sets
 * of names they are built from. It is the leaf of slice s04: `mode-schedule.ts`
 * imports it and `level-table.ts` imports both, so the three files form a chain
 * and never a cycle.
 *
 * Every number that fills these fields is documented, with its citation, in
 * docs/ARCADE-REFERENCE.md. Nothing here invents a value; `level-table.ts`
 * supplies them and `level-table.test.ts` asserts them against the document.
 */

/**
 * The global ghost mode. Not a ghost's own phase — all four ghosts share it,
 * because in the arcade one timer drives the whole quartet.
 *
 * A const object rather than an enum: `erasableSyntaxOnly` is on, so the type
 * layer must vanish entirely at build time. Same shape as `Direction`.
 */
export const GlobalMode = {
  Scatter: 'scatter',
  Chase: 'chase',
} as const;

export type GlobalMode = (typeof GlobalMode)[keyof typeof GlobalMode];

/**
 * One entry in a level's scatter/chase schedule.
 *
 * `durationFrames: null` means "and then this mode forever". It is a value the
 * type system forces a caller to handle, which an absent final array entry is
 * not: under `noUncheckedIndexedAccess` that would be an `undefined` handed to
 * the wave clock at the least convenient moment.
 */
export interface ModePhase {
  readonly mode: GlobalMode;
  /** Frames this phase lasts, or null for "until the level ends". */
  readonly durationFrames: number | null;
}

/**
 * The eight bonus items, in the order the arcade awards them.
 *
 * docs/ARCADE-REFERENCE.md section 3 records that the Dossier calls `orange`
 * and `melon` "Peach" and "Grapes"; same eight objects, same points.
 */
export const FruitKind = {
  Cherry: 'cherry',
  Strawberry: 'strawberry',
  Orange: 'orange',
  Apple: 'apple',
  Melon: 'melon',
  Galaxian: 'galaxian',
  Bell: 'bell',
  Key: 'key',
} as const;

export type FruitKind = (typeof FruitKind)[keyof typeof FruitKind];

/**
 * Every per-level number the arcade varies, in one flat readonly record.
 *
 * One record passed through `FrameContext` means no system anywhere branches on
 * the level number itself, so "level 5 ghosts are too slow" is a data fix with a
 * table test rather than a hunt through the AI.
 */
export interface LevelSpec {
  /** The level this spec was asked for. Above 21 it keeps the requested number
      while every other field comes from row 21 — see `levelSpec`. */
  readonly level: number;
  /** Fractions of full speed, exactly as docs/ARCADE-REFERENCE.md section 3
      states them: 0.8, never 80 and never 205 sub-pixels. `actor/speed.ts` is
      the one place they become sub-pixels per frame. */
  readonly pacmanSpeed: number;
  readonly pacmanDotSpeed: number;
  readonly pacmanFrightSpeed: number;
  readonly pacmanFrightDotSpeed: number;
  readonly ghostSpeed: number;
  readonly ghostTunnelSpeed: number;
  readonly ghostFrightSpeed: number;
  /** Dots REMAINING when Blinky enters Cruise Elroy stage 1. */
  readonly elroy1DotsLeft: number;
  readonly elroy1Speed: number;
  readonly elroy2DotsLeft: number;
  readonly elroy2Speed: number;
  /** 0 from level 19 on (and at level 17): a power pellet still scores and
      still reverses the ghosts, but nobody turns blue. */
  readonly frightenedFrames: number;
  readonly frightenedFlashes: number;
  readonly fruit: FruitKind;
  readonly fruitPoints: number;
  readonly waves: readonly ModePhase[];
}
