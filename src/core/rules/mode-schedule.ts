import { GlobalMode, type LevelSpec, type ModePhase } from './level-spec.ts';

/**
 * `GlobalMode` is declared in `level-spec.ts` — the leaf of this slice, which
 * imports nothing — and re-exported here because this is the module that OWNS
 * it: the wave clock is the only thing that ever changes it. Consumers such as
 * `ghost/targeting/target-context.ts` import it from here, where the behaviour
 * lives. Declaring it in the leaf is what keeps the three files a chain rather
 * than a cycle: level-spec <- mode-schedule <- level-table.
 */
export { GlobalMode } from './level-spec.ts';

/**
 * SIGNATURE-ONLY STUB — slice s04, RED phase.
 *
 * Every function below declares its real type and returns a deliberately inert
 * value. There is NO behaviour here, on purpose: the tests must fail on their
 * assertions with an expected-vs-received diff, not on `Cannot find module`,
 * which would prove nothing about the assertions at all. See
 * docs/TDD-CHARTER.md, Challenge 1.
 *
 * The rule that keeps the stub honest: it must not make a single assertion pass
 * that ought to be failing. That is why `INERT_MODES` is a zeroed record rather
 * than the caller's own state echoed back — echoing the input would silently
 * satisfy "the wave clock does not advance while frightened", the very
 * behaviour that test exists to pin.
 */

/**
 * The wave clock, as a value.
 *
 * `waveFrames` counts frames already spent in the current wave; `waveIndex`
 * indexes into the level's `waves`. Fright lives here too rather than on each
 * ghost, because the arcade's fright timer is global and it is what pauses this
 * clock — one fact, one field, no two sources of truth to drift apart.
 */
export interface ModeState {
  readonly waveIndex: number;
  readonly waveFrames: number;
  readonly frightenedFramesLeft: number;
}

/**
 * The whole output contract of one frame of the wave clock.
 *
 * Both booleans are EDGES: true on exactly the frame the thing happened, false
 * on every other frame. See docs/ARCADE-REFERENCE.md section 4.
 */
export interface ModeAdvance {
  readonly modes: ModeState;
  /** True only on the frame `waveIndex` changed. Scatter↔chase forces every
      ghost to turn around — once. */
  readonly reversalRequired: boolean;
  /** True only on the frame `frightenedFramesLeft` reached zero. */
  readonly frightenedEnded: boolean;
}

const INERT_MODES: ModeState = {
  waveIndex: 0,
  waveFrames: 0,
  frightenedFramesLeft: 0,
};

/**
 * The scatter/chase schedule for a level: level 1, levels 2-4, or levels 5 and
 * up. docs/ARCADE-REFERENCE.md section 4.
 */
export function wavesForLevel(_level: number): readonly ModePhase[] {
  return [];
}

/** The mode the ghosts are in right now, given where the wave clock stands. */
export function currentMode(_modes: ModeState, _spec: LevelSpec): GlobalMode {
  return GlobalMode.Scatter;
}

/** Advance the wave clock and the fright timer by exactly one frame. */
export function advanceModes(_modes: ModeState, _spec: LevelSpec): ModeAdvance {
  return { modes: INERT_MODES, reversalRequired: false, frightenedEnded: false };
}
