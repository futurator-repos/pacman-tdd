import { GHOST_ORDER, GhostId } from './ghost-id.ts';
import { type Ghost, GhostPhase } from './ghost.ts';

/**
 * The house's own state — the two things that are NOT properties of any one
 * ghost.
 *
 * Each ghost carries its personal counter on its own record (`Ghost.dotCounter`),
 * because it is a fact about that ghost. The global counter and the no-dot timer
 * are facts about the BOARD, and giving them to a ghost would mean four copies
 * of one number and four chances for them to disagree.
 *
 * docs/ARCADE-REFERENCE.md section 12, "The ghost house".
 */
export interface HouseState {
  /** Dots eaten since the switch. Only consulted while `globalCounterActive`. */
  readonly globalCounter: number;
  /** Set when a life is lost; the personal counters are ignored while it is on. */
  readonly globalCounterActive: boolean;
  /** Frames since the last dot was eaten. Feeds the four-second release. */
  readonly framesSinceDot: number;
}

/** Everything the release rule may read. */
export interface HouseContext {
  readonly house: HouseState;
  readonly ghosts: Readonly<Record<GhostId, Ghost>>;
  /** Personal limits and the no-dot timeout both vary by level. */
  readonly level: number;
}

/**
 * docs/ARCADE-REFERENCE.md section 12.1, keyed by the three level bands the
 * table actually has: level 1, level 2, and level 3 and up.
 *
 * Keyed by band number rather than stored as an array for the reason
 * `level-table.ts` gives at `LEVEL_ROWS`: an array would be
 * `… | undefined` at every index under `noUncheckedIndexedAccess`, forcing a
 * `?? someRow` that the clamp below makes unreachable — and a branch no test
 * can reach is a branch that should not exist.
 *
 * Blinky is in the table with a limit of 0 at every band because he has one:
 * he starts outside the house and only ever waits in it after being eaten, at
 * which point he leaves again immediately. Omitting him would make the record
 * partial and push an `undefined` into the comparison.
 */
const PERSONAL_LIMITS = {
  1: { [GhostId.Blinky]: 0, [GhostId.Pinky]: 0, [GhostId.Inky]: 30, [GhostId.Clyde]: 60 },
  2: { [GhostId.Blinky]: 0, [GhostId.Pinky]: 0, [GhostId.Inky]: 0, [GhostId.Clyde]: 50 },
  3: { [GhostId.Blinky]: 0, [GhostId.Pinky]: 0, [GhostId.Inky]: 0, [GhostId.Clyde]: 0 },
} as const satisfies Readonly<Record<number, Readonly<Record<GhostId, number>>>>;

/** The bands the table has a row for: 1, 2, and "3 and up". */
type LimitBand = keyof typeof PERSONAL_LIMITS;

const FIRST_BAND = 1;
const LAST_BAND = 3;

/**
 * The personal limits in force at a level.
 *
 * The assertion is doing real work rather than papering over a doubt:
 * `Math.min`/`Math.max` return `number`, and nothing else can tell the compiler
 * that the clamped value is one of the three keys. Same idiom, same reason, as
 * `tableLevel` in `level-table.ts`.
 */
function personalLimits(level: number): Readonly<Record<GhostId, number>> {
  return PERSONAL_LIMITS[Math.min(Math.max(level, FIRST_BAND), LAST_BAND) as LimitBand];
}

/**
 * docs/ARCADE-REFERENCE.md section 12.2 — the limits that replace the personal
 * ones once a life has been lost. Blinky is 0 for the reason given above.
 */
const GLOBAL_LIMITS: Readonly<Record<GhostId, number>> = {
  [GhostId.Blinky]: 0,
  [GhostId.Pinky]: 7,
  [GhostId.Inky]: 17,
  [GhostId.Clyde]: 32,
};

/**
 * The stalemate breaker, in frames: four seconds up to level 4 and three from
 * level 5 (docs/ARCADE-REFERENCE.md section 12.3, converted by section 1).
 *
 * Named constants rather than literals in the comparison, because "240" appears
 * in three unrelated tables in this game and only one of them is a timeout.
 */
const STALL_FRAMES_EARLY = 240;
const STALL_FRAMES_LATE = 180;

/**
 * One frame in which no dot was eaten.
 *
 * A whole function for one increment so that "the stall timer ages on FRAMES and
 * resets on DOTS" is written down in one place, next to the rule that reads it,
 * rather than being a `+= 1` inside a system where nothing points at it. Reset
 * it here instead and the four-second release can never fire in a real game
 * while its own unit test stays green.
 */
export function houseAfterFrame(house: HouseState): HouseState {
  return { ...house, framesSinceDot: house.framesSinceDot + 1 };
}

/**
 * A dot was eaten this frame: the timer restarts and the global counter, if it
 * is running, advances.
 *
 * The counter is guarded by its own flag rather than advanced unconditionally,
 * because it is only meaningful after a life is lost (section 12.2). Left
 * counting from the first dot of the game, it would already stand past 32 by the
 * first death and empty the house instantly at the worst possible moment.
 */
export function houseAfterDot(house: HouseState): HouseState {
  return {
    ...house,
    globalCounter: house.globalCounterActive ? house.globalCounter + 1 : house.globalCounter,
    framesSinceDot: 0,
  };
}

/**
 * Which ghost may leave the house this frame, or `null` for nobody.
 *
 * At most one per frame, and the earliest eligible ghost in `GHOST_ORDER`
 * (docs/ARCADE-REFERENCE.md section 12.4). Naming ONE ghost rather than a list
 * makes "all three pour out abreast" impossible to express, and it costs
 * nothing — the frames are 1/60 s apart.
 *
 * Three independent rules can free a ghost and this is all three, in one
 * predicate: the stall timer fires regardless of any counter, and otherwise the
 * counter consulted is the global one after a death and the ghost's personal one
 * before it — never both, which is the whole content of section 12.2.
 *
 * The comparison is `>=`, never `>`: a limit of 0 means "immediately", and from
 * level 3 on every personal limit is 0, so off by one here does not delay the
 * house — it closes it permanently.
 *
 * Only phase `InHouse` is a candidate. A ghost in `LeavingHouse` is already
 * walking out through the gate, and re-releasing a hunting ghost would teleport
 * it back to the door mid-chase. `dotCounterActive` is deliberately not read:
 * the phase already says whether a ghost is waiting, and a second flag saying
 * the same thing is a second thing to keep in step.
 *
 * The decision is separate from the transition on purpose — this function moves
 * nobody and changes no phase. That belongs to the house system in slice s11.
 */
export function releaseDecision(context: HouseContext): GhostId | null {
  const { house, ghosts, level } = context;

  const limits = house.globalCounterActive ? GLOBAL_LIMITS : personalLimits(level);
  const stalled = house.framesSinceDot >= (level <= 4 ? STALL_FRAMES_EARLY : STALL_FRAMES_LATE);

  const released = GHOST_ORDER.find((id) => {
    const ghost = ghosts[id];
    const counter = house.globalCounterActive ? house.globalCounter : ghost.dotCounter;
    return ghost.phase === GhostPhase.InHouse && (stalled || counter >= limits[id]);
  });

  return released ?? null;
}
