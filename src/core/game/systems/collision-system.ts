import { tileOf } from '../../actor/actor.ts';
import { type Tile } from '../../geometry/tile.ts';
import { GHOST_ORDER } from '../../ghost/ghost-id.ts';
import { GhostPhase, type Ghost } from '../../ghost/ghost.ts';
import { CollisionOutcome, resolveCollision } from '../../rules/collision.ts';
import { chainAfterGhostEaten, ghostPoints } from '../../rules/ghost-combo.ts';
import { addScore } from '../../rules/score.ts';
import { type GameEvent } from '../game-event.ts';
import { PHASE_FRAMES, RoundPhase } from '../game-phase.ts';
import { type GameState } from '../game-state.ts';
import {
  type FrameContext,
  type System,
  type SystemResult,
  type SystemId,
  unchanged,
} from '../system.ts';

/**
 * Pac-Man meets a ghost, and the frame is either worth 1600 points or a life.
 *
 * This file DECIDES nothing. `rules/collision.ts` owns the three outcomes,
 * `rules/ghost-combo.ts` owns the ladder and what the chain index means, and
 * `rules/score.ts` owns the 10000 crossing; all three are green against the
 * arcade tables already. What is left — and it is the whole job of a system — is
 * to ask them in the right order and write the answers into the world.
 *
 * ONE ARCADE RULE IS APPROXIMATED HERE, AND THE APPROXIMATION IS DELIBERATE.
 * docs/ARCADE-REFERENCE.md section 13.2 counts the ladder by "ghosts eaten so
 * far THIS FRIGHT", and `GameState` carries no such counter — `game-state.ts`
 * lists every field it does carry, and `eat-system.ts` records the same absence
 * from the other end. So the count is read off the ghosts themselves: a ghost is
 * in `Eyes` or `EnteringHouse` for exactly one reason, which is that it was
 * eaten and has not got home yet. The two answers differ in one situation — a
 * fright that ends while a previous pair of eyes is still travelling, after
 * which the next fright's first ghost is read as the second of a chain and pays
 * 400. The honest fix is the missing field, not a second rule here; whichever
 * slice adds it should delete `ghostsHeadingHome` and read the counter.
 */

/**
 * How many ghosts have already been eaten and are still on their way home.
 *
 * BOTH phases count, and that is the point of the function existing rather than
 * being an inline `=== GhostPhase.Eyes`: a ghost that reaches the door and
 * switches to `EnteringHouse` has not become un-eaten, and counting only `Eyes`
 * would drop a rung of the ladder for as long as it took to cross the doorway —
 * a scoring bug that appears and disappears depending on where the eyes are.
 *
 * `GHOST_ORDER` rather than `Object.values`, for the reason `ghost-id.ts` gives:
 * key order is a property of how the record happens to be typed, and nothing
 * that affects the score should depend on that.
 */
function ghostsHeadingHome(ghosts: GameState['ghosts']): number {
  return GHOST_ORDER.filter(
    (id) => ghosts[id].phase === GhostPhase.Eyes || ghosts[id].phase === GhostPhase.EnteringHouse,
  ).length;
}

/**
 * Eat one ghost: score it, send it home, and announce it with its own value.
 *
 * The points and the chain index are both asked of `rules/ghost-combo.ts` with
 * the SAME count, so the event's `chain` and its `points` can never describe
 * different rungs — which they could if either were recomputed here.
 *
 * The extra life rides along because `addScore` reports the 10000 crossing
 * exactly once (section 13.3). A system that added ghost points and dropped that
 * report would not delay the life, it would DELETE it: every later addition
 * truthfully reports false, and section 13.3's own worked example — a chain
 * leaping from 9000 to 10600 — is the ordinary way a player passes 10000.
 *
 * The ghost's fright timer is deliberately left running. `rules/collision.ts`
 * explains why: fright is one global timer, so `isFrightened` stays true of a
 * pair of eyes and the PHASE is what makes them harmless.
 */
function eatGhost(frame: SystemResult, ghost: Ghost): SystemResult {
  const eatenSoFar = ghostsHeadingHome(frame.state.ghosts);
  const points = ghostPoints(eatenSoFar);
  const scored = addScore(frame.state.score, points);
  const eaten: GameEvent = {
    kind: 'ghostEaten',
    ghost: ghost.id,
    points,
    chain: chainAfterGhostEaten(eatenSoFar),
  };

  const state: GameState = {
    ...frame.state,
    score: scored.score,
    ghosts: { ...frame.state.ghosts, [ghost.id]: { ...ghost, phase: GhostPhase.Eyes } },
  };

  if (!scored.extraLifeAwarded) {
    return { state, events: [...frame.events, eaten] };
  }

  const lives = state.lives + 1;
  return {
    state: { ...state, extraLifeAwarded: true, lives },
    events: [...frame.events, eaten, { kind: 'extraLife', lives }],
  };
}

/**
 * The catch: start the death freeze and name the culprit.
 *
 * The phase AND its countdown, never one without the other. `phase-system.ts`
 * reads zero frames left as "this phase has no timer", so a `dying` with no
 * duration would hang the machine on the frame of death forever.
 *
 * The life is not spent here. `life-system` runs last in the same frame and
 * hears this event, which is what keeps one capture costing one life however
 * many times per frame the overlap is looked at.
 */
function catchPacman(frame: SystemResult, ghost: Ghost): SystemResult {
  return {
    state: {
      ...frame.state,
      phase: RoundPhase.Dying,
      phaseFramesLeft: PHASE_FRAMES[RoundPhase.Dying],
    },
    events: [...frame.events, { kind: 'pacmanCaught', ghost: ghost.id }],
  };
}

/**
 * One ghost against one tile, folded into the frame so far.
 *
 * The guard is what makes a second catch impossible: a catch has already moved
 * the phase out of `playing`, so the ghosts after the killer in `GHOST_ORDER`
 * see a world that is no longer simulating and are left alone. It is the same
 * question the system asks on entry, which is why running the whole system twice
 * a frame is CORRECT rather than merely tolerated.
 *
 * The ghost is read out of `frame.state` rather than the state the run began
 * with, so what is resolved is the world as it is now — the accumulated one.
 */
function resolveGhost(frame: SystemResult, ghost: Ghost, pacmanTile: Tile): SystemResult {
  if (frame.state.phase !== RoundPhase.Playing) {
    return frame;
  }

  switch (resolveCollision(pacmanTile, ghost)) {
    case CollisionOutcome.GhostEaten:
      return eatGhost(frame, ghost);
    case CollisionOutcome.PacmanCaught:
      return catchPacman(frame, ghost);
    case CollisionOutcome.Nothing:
      return frame;
  }
}

/**
 * A collision system, built twice.
 *
 * A FACTORY rather than a constant, because the pipeline installs two of these:
 * `collision-early` after Pac-Man moves and `collision-late` after the ghosts
 * move (`system.ts`, `SystemId`). That pair is what reproduces the arcade's
 * pass-through — two actors that EXCHANGE adjacent tiles never share one on any
 * frame, so neither notices the other (docs/ARCADE-REFERENCE.md section 13.5).
 * The id is carried rather than hard-coded so the two instances stay
 * distinguishable in the pipeline's ordering test and in any trace.
 *
 * Running twice is safe because both outcomes REMOVE their own cause: an eaten
 * ghost becomes eyes, which section 13.5 exempts, and a catch ends the playing
 * phase. Nothing here counts, latches or remembers.
 *
 * It resolves nothing outside `playing`. The pauses are real time in which the
 * world does not move (section 7.2), and a ghost that happens to be standing on
 * Pac-Man during the READY! countdown or the maze flash must not kill him for it.
 */
export function createCollisionSystem(
  id: typeof SystemId.CollisionEarly | typeof SystemId.CollisionLate,
): System {
  return {
    id,
    run(state: GameState, _ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
      if (state.phase !== RoundPhase.Playing) {
        return unchanged(state);
      }

      const pacmanTile = tileOf(state.pacman.actor);

      /* The seed is `unchanged(state)`, so a frame in which nobody touched
         anybody returns the very state object that went in — `system.ts` says
         identity is asserted downstream, and most frames are that frame. */
      return GHOST_ORDER.reduce<SystemResult>(
        (frame, ghostId) => resolveGhost(frame, frame.state.ghosts[ghostId], pacmanTile),
        unchanged(state),
      );
    },
  };
}
