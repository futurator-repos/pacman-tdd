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

/**
 * The wave every schedule ends on, and therefore the answer for any index past
 * the end of one.
 *
 * It is a named constant rather than an `if` at each lookup because it is the
 * same fact twice: docs/ARCADE-REFERENCE.md section 4 states that after the
 * fourth scatter period the ghosts chase permanently, so "off the end of the
 * schedule" and "the last entry" describe one state, not two.
 */
const ENDLESS_CHASE: ModePhase = { mode: GlobalMode.Chase, durationFrames: null };

/**
 * Total lookup into a level's schedule.
 *
 * Sharing one accessor between `currentMode` and `advanceModes` is what keeps
 * the out-of-range case a single decision made in a single place: under
 * `noUncheckedIndexedAccess` a raw `waves[i]` is `ModePhase | undefined`, and an
 * `undefined` reaching either caller would crash at whatever minute of play the
 * last wave happened to expire.
 */
function phaseAt(waves: readonly ModePhase[], waveIndex: number): ModePhase {
  return waves[waveIndex] ?? ENDLESS_CHASE;
}

/** Level 1's schedule. docs/ARCADE-REFERENCE.md section 4, "Level 1". */
const LEVEL_1_WAVES: readonly ModePhase[] = [
  { mode: GlobalMode.Scatter, durationFrames: 420 }, // 7 s
  { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
  { mode: GlobalMode.Scatter, durationFrames: 420 }, // 7 s
  { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
  { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
  { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
  { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
  ENDLESS_CHASE,
];

/**
 * Levels 2 to 4. docs/ARCADE-REFERENCE.md section 4, "Levels 2 to 4".
 *
 * The one-frame scatter at index 6 is real, not a transcription slip: from
 * level 2 on the fourth scatter period lasts a single frame, long enough to
 * force the reversal and nothing more.
 */
const LEVELS_2_TO_4_WAVES: readonly ModePhase[] = [
  { mode: GlobalMode.Scatter, durationFrames: 420 }, // 7 s
  { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
  { mode: GlobalMode.Scatter, durationFrames: 420 }, // 7 s
  { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
  { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
  { mode: GlobalMode.Chase, durationFrames: 61980 }, // 1033 s
  { mode: GlobalMode.Scatter, durationFrames: 1 }, // 1/60 s — one frame
  ENDLESS_CHASE,
];

/** Levels 5 and up. docs/ARCADE-REFERENCE.md section 4, "Levels 5 and up". */
const LEVELS_5_UP_WAVES: readonly ModePhase[] = [
  { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
  { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
  { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
  { mode: GlobalMode.Chase, durationFrames: 1200 }, // 20 s
  { mode: GlobalMode.Scatter, durationFrames: 300 }, // 5 s
  { mode: GlobalMode.Chase, durationFrames: 62220 }, // 1037 s
  { mode: GlobalMode.Scatter, durationFrames: 1 }, // 1/60 s — one frame
  ENDLESS_CHASE,
];

/**
 * The scatter/chase schedule for a level: level 1, levels 2-4, or levels 5 and
 * up. docs/ARCADE-REFERENCE.md section 4.
 *
 * The bounds are written as `<=` against the LAST level each table serves
 * rather than as `<` against the first level of the next one, so a reader
 * checking this against the document compares the same numbers the document
 * prints. Levels below 1 take level 1's table for the same reason `levelSpec`
 * clamps: no caller should have to know the domain to ask a question.
 */
export function wavesForLevel(level: number): readonly ModePhase[] {
  if (level <= 1) {
    return LEVEL_1_WAVES;
  }
  if (level <= 4) {
    return LEVELS_2_TO_4_WAVES;
  }
  return LEVELS_5_UP_WAVES;
}

/** The mode the ghosts are in right now, given where the wave clock stands. */
export function currentMode(modes: ModeState, spec: LevelSpec): GlobalMode {
  return phaseAt(spec.waves, modes.waveIndex).mode;
}

/**
 * Advance the wave clock and the fright timer by exactly one frame.
 *
 * The fright branch comes FIRST and returns without touching the wave clock,
 * because that ordering IS the arcade rule: docs/ARCADE-REFERENCE.md section 4
 * quotes the Dossier — while the ghosts are frightened the scatter/chase timer
 * is paused, and it resumes afterwards from where it stopped. Written the other
 * way round, every power pellet would quietly spend several seconds of the
 * player's scatter time and the late waves would arrive early.
 *
 * A consequence worth naming: the frame on which fright falls from 1 to 0 is
 * still a frozen frame, since the timer was above zero at the START of it.
 */
export function advanceModes(modes: ModeState, spec: LevelSpec): ModeAdvance {
  if (modes.frightenedFramesLeft > 0) {
    const frightenedFramesLeft = modes.frightenedFramesLeft - 1;
    return {
      modes: { ...modes, frightenedFramesLeft },
      /* Fright ENDING is absent from the Dossier's list of reversal triggers,
         so nobody turns around here. */
      reversalRequired: false,
      frightenedEnded: frightenedFramesLeft === 0,
    };
  }

  const waveFrames = modes.waveFrames + 1;
  const { durationFrames } = phaseAt(spec.waves, modes.waveIndex);

  /* A wave flips when the frames spent in it REACH its duration; `null` means
     "and then this mode forever", which is why the null check is explicit and
     not a `?? 0` — a zero-length wave would flip sixty times a second. */
  if (durationFrames !== null && waveFrames >= durationFrames) {
    return {
      modes: { ...modes, waveIndex: modes.waveIndex + 1, waveFrames: 0 },
      reversalRequired: true,
      frightenedEnded: false,
    };
  }

  return {
    modes: { ...modes, waveFrames },
    reversalRequired: false,
    frightenedEnded: false,
  };
}
