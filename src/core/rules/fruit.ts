/**
 * The bonus item: a tiny state machine driven by a dot count and a countdown.
 *
 * Two things make this worth its own module rather than a few fields on the
 * fruit system. First, the trigger is the number of dots EATEN — 70 and 170,
 * docs/ARCADE-REFERENCE.md section 13.4 — so the rule has to be asked once per
 * frame with that count, and asking it directly is the only way to test the
 * second appearance without eating 170 dots first. Second, "twice per level and
 * never a third time" is a counter, not a comparison, and the counter is exactly
 * what a `dotsEaten >= 70` implementation forgets.
 *
 * `stepFruit` takes the LevelSpec rather than a FruitKind because a bonus item
 * is whatever the current level's row says it is (section 3), and its value is
 * `spec.fruitPoints` for the same reason. There is no second fruit table.
 *
 * STUB (slice s08 RED): both functions return fixed inert values and read none
 * of their arguments. Notably `stepFruit` does NOT return the state it was
 * handed: echoing the input is behaviour, and it would make "nothing happens on
 * the sixty-ninth dot" pass for the wrong reason.
 */
import { type FruitKind, type LevelSpec } from './level-spec.ts';

/**
 * The bonus item's whole existence, as a value.
 *
 * `onBoard` is `FruitKind | null` rather than an optional field: under
 * `exactOptionalPropertyTypes` an absent property and a present `undefined` are
 * different types, and "there is no fruit" is a state the game is in for most of
 * a level. It deserves a value, not a missing key.
 */
export interface FruitState {
  /** The item currently sitting on the board, or null when there is none. */
  readonly onBoard: FruitKind | null;
  /** Frames until it vanishes. Zero whenever `onBoard` is null. */
  readonly framesLeft: number;
  /** How many of the level's two bonuses have already appeared: 0, 1 or 2. */
  readonly spawned: number;
}

/** An empty board: no fruit showing, and none of the level's two used up. */
export const NO_FRUIT: FruitState = { onBoard: null, framesLeft: 0, spawned: 0 };

/**
 * One frame of the bonus item's life.
 *
 * Both reported items are EDGES, on the same terms as `frightenedEnded` in
 * `mode-schedule.ts`: each names the item that appeared or expired on THIS
 * frame, and is null on every other frame. A level therefore reports at most two
 * appearances and at most two expiries, however many times it is stepped.
 */
export interface FruitStep {
  readonly fruit: FruitState;
  readonly appeared: FruitKind | null;
  readonly expired: FruitKind | null;
}

export function stepFruit(_fruit: FruitState, _dotsEaten: number, _spec: LevelSpec): FruitStep {
  return { fruit: NO_FRUIT, appeared: null, expired: null };
}

/** What eating the bonus item is worth, and the board it leaves behind. */
export interface FruitBite {
  readonly fruit: FruitState;
  /** The item eaten, or null when there was nothing there to eat. */
  readonly eaten: FruitKind | null;
  /** `spec.fruitPoints` when something was eaten, and zero otherwise. */
  readonly points: number;
}

/**
 * Take the bonus item off the board.
 *
 * Total, with no guard required at the call site: collision with the fruit tile
 * happens whenever Pac-Man crosses it, which is many times a level and usually
 * with no fruit there. Scoring nothing for nothing is the rule, not an error.
 */
export function eatFruit(_fruit: FruitState, _spec: LevelSpec): FruitBite {
  return { fruit: NO_FRUIT, eaten: null, points: 0 };
}
