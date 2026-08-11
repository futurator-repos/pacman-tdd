import { tileAt, tileEquals } from '../../geometry/tile.ts';
import { eatFruit, stepFruit } from '../../rules/fruit.ts';
import { addScore } from '../../rules/score.ts';
import { type GameEvent } from '../game-event.ts';
import { RoundPhase } from '../game-phase.ts';
import { type GameState } from '../game-state.ts';
import {
  type FrameContext,
  type System,
  type SystemResult,
  SystemId,
  unchanged,
} from '../system.ts';

/**
 * The bonus item, wired into a frame.
 *
 * WHY THIS IS AN ADAPTER AND NOT A RULE. Everything the arcade says about the
 * fruit — 70 dots and 170, 570 frames, twice a level and never a third time,
 * worth whatever the level's row says — lives in `rules/fruit.ts` and is tested
 * there against docs/ARCADE-REFERENCE.md 13.4. Not one of those numbers appears
 * in this file, because a number written twice is a number that can disagree
 * with itself. What is here is only the three things a FRAME has to decide:
 * which count the rule is handed, whether Pac-Man is standing on the item, and
 * what the rest of the game gets told about it.
 *
 * WHY IT RUNS TENTH. After both collision passes, and so after the eat system,
 * which means `pellets.eaten` already includes the dot swallowed on THIS frame.
 * That is what lets the seventieth dot and the cherry it earns happen on the
 * same frame, as they do in the arcade.
 */
export const fruitSystem: System = {
  id: SystemId.Fruit,

  /**
   * Step the item, then take it if Pac-Man is standing on it.
   *
   * That order is the arcade's, and it is the reason the two calls are not
   * independent: an item that appears under Pac-Man's feet on the frame he eats
   * the seventieth dot is eaten on that frame rather than on the next one.
   *
   * `incoming` is deliberately unread. The dot count is STATE, and recovering
   * it by counting `pelletEaten` events instead would make this system's answer
   * depend on which systems happened to run before it — precisely the coupling
   * the event channel exists to avoid.
   */
  run(state: GameState, ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
    /* `playing` is the only phase in which the world is simulated
       (game-phase.ts). Without this gate the 180 frames of the death pause and
       the 120 of the READY! that follows would drain more than half the life
       out of a bonus the player never got the chance to reach. */
    if (state.phase !== RoundPhase.Playing) {
      return unchanged(state);
    }

    const step = stepFruit(state.fruit, state.pellets.eaten, ctx.spec);

    /* Tile occupancy on BOTH axes, asked through `tileEquals` rather than
       written out here: Pac-Man's spawn shares the fruit tile's column and the
       corridor to its left shares its row, so half of this comparison would
       harvest the bonus from across the maze. `eatFruit` is total, so the only
       guard it needs is the one about WHERE Pac-Man is. */
    const onFruitTile = tileEquals(tileAt(state.pacman.actor.position), ctx.maze.fruitTile);
    const bite = onFruitTile ? eatFruit(step.fruit, ctx.spec) : null;
    const fruit = bite?.fruit ?? step.fruit;

    /* Both rules hand back the value they were given when nothing happened, so
       this single identity check answers "was this frame a no-op?" for all of
       appearing, expiring and eating — and the state goes back out as the very
       object that came in, which `runSystems` and every identity assertion
       downstream depend on. */
    if (fruit === state.fruit) {
      return unchanged(state);
    }

    const scored = addScore(state.score, bite?.points ?? 0);
    const lives = scored.extraLifeAwarded ? state.lives + 1 : state.lives;
    const events: GameEvent[] = [];

    if (step.appeared !== null) {
      events.push({ kind: 'fruitAppeared', fruit: step.appeared });
    }
    if (step.expired !== null) {
      events.push({ kind: 'fruitExpired', fruit: step.expired });
    }
    if (bite !== null && bite.eaten !== null) {
      events.push({ kind: 'fruitEaten', fruit: bite.eaten, points: bite.points });
    }
    if (scored.extraLifeAwarded) {
      /* Emitted AFTER the fruit that earned it: the event list is read in
         emission order as an audio script, so the bonus-life chime has to
         follow the fruit rather than race it. */
      events.push({ kind: 'extraLife', lives });
    }

    return {
      state: {
        ...state,
        fruit,
        score: scored.score,
        lives,
        /* A latch, so it is OR-ed rather than assigned: this frame is only ever
           allowed to set it. Assigning `scored.extraLifeAwarded` straight would
           clear a bonus already paid for the first time the player ate the next
           cherry. */
        extraLifeAwarded: state.extraLifeAwarded || scored.extraLifeAwarded,
      },
      events,
    };
  },
};
