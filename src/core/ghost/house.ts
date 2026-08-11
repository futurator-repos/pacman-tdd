import { type GhostId } from './ghost-id.ts';
import { type Ghost } from './ghost.ts';

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
 * One frame in which no dot was eaten.
 *
 * SIGNATURE-ONLY STUB — returns its argument untouched. Returning the input is
 * the most inert answer available for a state transition: it asserts nothing
 * about the new value, so every test that expects a CHANGE fails, and none can
 * pass by accident on a field that happened to start at the expected value.
 */
export function houseAfterFrame(house: HouseState): HouseState {
  return house;
}

/**
 * A dot was eaten this frame: the timer restarts and the global counter, if it
 * is running, advances.
 *
 * SIGNATURE-ONLY STUB — returns its argument untouched. See `houseAfterFrame`.
 */
export function houseAfterDot(house: HouseState): HouseState {
  return house;
}

/**
 * Which ghost may leave the house this frame, or `null` for nobody.
 *
 * At most one per frame, and the earliest eligible ghost in `GHOST_ORDER` —
 * docs/ARCADE-REFERENCE.md section 12.4.
 *
 * SIGNATURE-ONLY STUB — `null` is the inert answer, and it is the one that
 * cannot fake a release: every test below pairs its "nobody yet" expectation
 * with a "and now this ghost" expectation in the same `it`, so the stub's
 * eternal `null` fails every one of them.
 */
export function releaseDecision(_context: HouseContext): GhostId | null {
  return null;
}
