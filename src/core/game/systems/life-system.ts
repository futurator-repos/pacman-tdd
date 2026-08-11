import { type HouseState } from '../../ghost/house.ts';
import { LifeOutcome, loseLife } from '../../rules/lives.ts';
import { type GameEvent } from '../game-event.ts';
import { PHASE_FRAMES, RoundPhase } from '../game-phase.ts';
import { type GameState } from '../game-state.ts';
import { startRound } from '../new-game.ts';
import {
  type FrameContext,
  type System,
  type SystemResult,
  SystemId,
  unchanged,
} from '../system.ts';

/**
 * The house, the moment a life is lost.
 *
 * docs/ARCADE-REFERENCE.md section 12.2: losing a life switches the machine to
 * the GLOBAL dot counter, and the personal counters are ignored entirely while
 * it is active. It starts at zero because its limits — Pinky 7, Inky 17, Clyde
 * 32 — are counted from the switch, and the stall timer starts again with it:
 * the four-second release (section 12.3) should measure the new life, not the
 * silence at the end of the old one.
 *
 * A named constant rather than three fields inside the return below, because
 * this is a claim from the reference and it deserves to be pointed at.
 */
const HOUSE_AFTER_A_DEATH: HouseState = {
  globalCounter: 0,
  globalCounterActive: true,
  framesSinceDot: 0,
};

/**
 * Turns the collision system's `pacmanCaught` into its one consequence.
 *
 * WHY IT LISTENS RATHER THAN LOOKS. The catch is a fact about two tiles and it
 * is detected twice a frame — collision runs once after Pac-Man moves and again
 * after the ghosts move, which is what reproduces the arcade pass-through
 * (`SystemId`). This file asks only whether the frame CONTAINS a catch, so the
 * two passes cost one life between them. Re-deriving the overlap here would
 * give the frame two definitions of "caught", and the day they disagreed the
 * player would lose two lives to one ghost.
 *
 * WHY IT SPENDS THE LIFE NOW RATHER THAN WHEN THE ANIMATION ENDS. `loseLife`'s
 * outcome is worded as "what happens after the death animation finishes", and
 * that is exactly what it decides — but it is decided HERE, at the catch,
 * because the answer chooses which animation plays at all. A game over never
 * enters `dying`: with no life left there is no round to come back to, so
 * phase-system's `NEXT_PHASE` can say that `dying` always leads to `ready` and
 * be right every time.
 *
 * WHY IT RUNS LAST. It is the only system that can end the frame's world, and
 * everything before it — the eat, the fruit, the last dot of the level — should
 * have its say first. A player who clears the board on the same frame they are
 * caught keeps the points.
 *
 * WHY THE RESPAWN IS `startRound` MINUS THE BOARD. The round genuinely restarts:
 * actors on their spawn tiles, the wave clock back to wave 0, no fruit and no
 * fright (docs/ARCADE-REFERENCE.md section 7.3). The one thing that must NOT
 * come back is the food — the dots the player ate stay eaten, or the round could
 * never be finished — so the pellet field is threaded through the reset. That
 * override is the whole reason this is not simply a call to `startRound`.
 */
export const lifeSystem: System = {
  id: SystemId.Life,
  run(state: GameState, _ctx: FrameContext, incoming: readonly GameEvent[]): SystemResult {
    if (!incoming.some((event) => event.kind === 'pacmanCaught')) {
      return unchanged(state);
    }

    const { lives, outcome } = loseLife(state.lives);
    /* The count that is LEFT, not the one that was there: the HUD draws this
       number, and the audio director's death cue reads the same event. */
    const died: GameEvent = { kind: 'pacmanDied', livesLeft: lives };

    if (outcome === LifeOutcome.GameOver) {
      return {
        state: {
          ...state,
          lives,
          phase: RoundPhase.GameOver,
          phaseFramesLeft: PHASE_FRAMES[RoundPhase.GameOver],
        },
        /* The death first, then the end of the game: the events are the audio
           script, and the death cry has to start before the loops are stopped.
           The score travels ON the event because a `gameOver` is the one moment
           a consumer needs the final figure without reaching for the state. */
        events: [died, { kind: 'gameOver', score: state.score }],
      };
    }

    return {
      state: {
        ...startRound(state, state.level),
        pellets: state.pellets,
        lives,
        /* The freeze, not the READY! pause `startRound` opens with: the death
           animation plays first (section 7.2, 180 frames), and the phase system
           is what turns it into `ready` when it ends. */
        phase: RoundPhase.Dying,
        phaseFramesLeft: PHASE_FRAMES[RoundPhase.Dying],
        house: HOUSE_AFTER_A_DEATH,
      },
      events: [died],
    };
  },
};
