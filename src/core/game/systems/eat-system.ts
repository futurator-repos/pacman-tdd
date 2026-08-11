import { tileAt } from '../../geometry/tile.ts';
import { GhostId } from '../../ghost/ghost-id.ts';
import { type Ghost } from '../../ghost/ghost.ts';
import { eat } from '../../pacman/eat.ts';
import { POINTS } from '../../rules/points.ts';
import { addScore } from '../../rules/score.ts';
import { type GameEvent } from '../game-event.ts';
import { type GameState } from '../game-state.ts';
import {
  type FrameContext,
  type System,
  type SystemResult,
  SystemId,
  unchanged,
} from '../system.ts';

/**
 * The frame's one bite: what was under Pac-Man when he arrived, and everything
 * that follows from it.
 *
 * This file OWNS no rule. `eat()` decides what is on the tile and what the
 * freeze costs, `POINTS` holds the 10 and the 50, and `addScore` owns the 10000
 * crossing; the job here is to ask them in the right order and to write the
 * answers into the world. That is why the whole system is one read, one lookup
 * and one merge — a system is an adapter, and an adapter that starts deciding
 * things is a second copy of a rule that will disagree with the first.
 *
 * The two events `eat()` returns are forwarded VERBATIM rather than translated.
 * They were declared in `pacman/eat.ts` as a structural subset of two
 * `GameEvent` variants precisely so that this could be a pass-through: a
 * translation step here would be a second place where the remaining-pellet
 * count or the fright duration could be got wrong.
 *
 * ONE ARCADE RULE IS NOT IMPLEMENTED HERE, AND THE ABSENCE IS DELIBERATE.
 * docs/ARCADE-REFERENCE.md section 13.2 says the ghost-score ladder resets when
 * the FRIGHT PERIOD ENDS, not on each energizer — so an energizer taken while
 * the ghosts are already blue extends the fright and leaves the ladder
 * climbing. `rules/ghost-combo.ts` implements exactly that as
 * `chainAfterPowerPellet`, and it is green. But `GameState` carries no "ghosts
 * eaten this fright" counter, so there is nowhere for this system to write a
 * reset to and no test could observe one; importing the rule in order to
 * discard its answer would be dead code wearing a compliance costume. What this
 * system CAN honour, and does, is the half of that rule it owns: an overlapping
 * energizer REFRESHES the one fright timer rather than starting a second.
 */

/**
 * Start — or extend — the fright, and turn every ghost around.
 *
 * TWO timers are set, not one, and they answer different questions.
 * `modes.frightenedFramesLeft` is what pauses the scatter/chase clock
 * (section 4); each ghost's own timer is what `isFrightened` reads, and
 * therefore what makes a ghost blue, slow and edible. Setting only one of them
 * gives a game that looks right and plays wrong in one direction or the other.
 *
 * Nothing here is conditional on the duration being non-zero. From level 19 it
 * IS zero (section 3), and an energizer up there still scores and still
 * reverses the ghosts — the reversal being the only thing a power pellet is
 * still good for, a guard around it would quietly delete the last reason to eat
 * one.
 *
 * The four ghosts are written out rather than folded over, for the reason
 * `new-game.ts` gives at `openRound`: a `Record<GhostId, Ghost>` rebuilt by a
 * fold needs a cast to stay total, and a literal cannot lose a ghost.
 */
function startFright(state: GameState, frames: number): GameState {
  const frighten = (ghost: Ghost): Ghost => ({
    ...ghost,
    frightenedFramesLeft: frames,
    reverseQueued: true,
  });

  return {
    ...state,
    ghosts: {
      [GhostId.Blinky]: frighten(state.ghosts[GhostId.Blinky]),
      [GhostId.Pinky]: frighten(state.ghosts[GhostId.Pinky]),
      [GhostId.Inky]: frighten(state.ghosts[GhostId.Inky]),
      [GhostId.Clyde]: frighten(state.ghosts[GhostId.Clyde]),
    },
    modes: { ...state.modes, frightenedFramesLeft: frames },
  };
}

/**
 * Eats whatever is under Pac-Man, scores it, and starts the fright.
 *
 * It runs immediately after Pac-Man moves and before the first collision check,
 * which is what makes an energizer taken on the very frame a ghost reaches him
 * a rescue rather than a death.
 */
export const eatSystem: System = {
  id: SystemId.Eat,
  run(state: GameState, ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
    const bite = eat(state.pellets, tileAt(state.pacman.actor.position), ctx.spec);

    /* Under `noUncheckedIndexedAccess` this read is the empty-tile branch as
       well as the event: `eat()` returns exactly zero or one event, so an
       `undefined` here IS "there was nothing there" — and that case must return
       the SAME state object, because most frames are that case. */
    const eaten = bite.events[0];
    if (eaten === undefined) {
      return unchanged(state);
    }

    const scored = addScore(
      state.score,
      eaten.kind === 'pelletEaten' ? POINTS.pellet : POINTS.powerPellet,
    );
    /* `stopFrames` is assigned, never added to: section 8.2's [repo
       convention] — an energizer eaten while a dot's frame is still pending
       costs 3 frames, not 4. */
    const fed: GameState = {
      ...state,
      pacman: { ...state.pacman, stopFrames: bite.stopFrames },
      pellets: bite.pellets,
      score: scored.score,
    };
    const frightened =
      eaten.kind === 'powerPelletEaten' ? startFright(fed, ctx.spec.frightenedFrames) : fed;

    if (!scored.extraLifeAwarded) {
      return { state: frightened, events: [eaten] };
    }

    /* The crossing, and only the crossing. `addScore` reports it true on the
       single addition that takes the score past 10000 and false on every one
       after it (section 13.3), so there is no latch to consult here — and
       consulting one would add a branch no legal game can reach. */
    const lives = frightened.lives + 1;
    return {
      state: { ...frightened, extraLifeAwarded: true, lives },
      events: [eaten, { kind: 'extraLife', lives }],
    };
  },
};
