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
 * Dots eaten when the level's FIRST bonus appears.
 * docs/ARCADE-REFERENCE.md section 13.4.
 *
 * Eaten, never remaining. Cruise Elroy counts the other way (section 5), so the
 * two counts live a few files apart in one codebase and are the classic pair to
 * swap; naming this one after the count it takes is the cheapest guard there is.
 */
const FIRST_FRUIT_DOTS = 70;

/** Dots eaten when the SECOND — and last — bonus appears. Same section. */
const SECOND_FRUIT_DOTS = 170;

/**
 * How long an uneaten bonus stays on the board.
 *
 * 570 frames is 9.5 seconds at the 60 fps of section 1, the midpoint of the
 * Dossier's "between nine and ten seconds". A [repo convention] fixed rather
 * than drawn from the injected Rng: a draw here would consume the same stream
 * the frightened ghosts turn on, so two replays of one input log would diverge
 * on how quickly the player reached the seventieth dot.
 */
const FRUIT_LIFETIME_FRAMES = 570;

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

/**
 * Advance the bonus item by one frame.
 *
 * The trigger is written against `spawned` as well as `dotsEaten`, and with `===`
 * rather than `>=`, because both halves are what make "twice per level" true:
 * the equality fires on one frame only and the counter is what stops a third
 * appearance ever being due. Together they mean this is safe to call every
 * frame with a dot count that only climbs.
 */
export function stepFruit(fruit: FruitState, dotsEaten: number, spec: LevelSpec): FruitStep {
  const dueNow =
    (fruit.spawned === 0 && dotsEaten === FIRST_FRUIT_DOTS) ||
    (fruit.spawned === 1 && dotsEaten === SECOND_FRUIT_DOTS);

  if (dueNow) {
    return {
      fruit: {
        onBoard: spec.fruit,
        framesLeft: FRUIT_LIFETIME_FRAMES,
        spawned: fruit.spawned + 1,
      },
      appeared: spec.fruit,
      expired: null,
    };
  }

  if (fruit.onBoard === null) {
    /* Nothing on the board and nothing due: the same value back, so a frame in
       which nothing happens costs no allocation and no edge. */
    return { fruit, appeared: null, expired: null };
  }

  const framesLeft = fruit.framesLeft - 1;

  if (framesLeft === 0) {
    return {
      fruit: { onBoard: null, framesLeft: 0, spawned: fruit.spawned },
      appeared: null,
      /* `spawned` is deliberately carried through: an expired bonus is a bonus
         spent, and resetting it here would put a fresh one out every hundred
         dots for the rest of the level. */
      expired: fruit.onBoard,
    };
  }

  return { fruit: { ...fruit, framesLeft }, appeared: null, expired: null };
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
export function eatFruit(fruit: FruitState, spec: LevelSpec): FruitBite {
  if (fruit.onBoard === null) {
    return { fruit, eaten: null, points: 0 };
  }

  return {
    fruit: { onBoard: null, framesLeft: 0, spawned: fruit.spawned },
    eaten: fruit.onBoard,
    points: spec.fruitPoints,
  };
}
