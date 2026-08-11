import { moveActor } from '../../actor/move-actor.ts';
import { speedSubPixels } from '../../actor/speed.ts';
import { pacmanTurnPolicy } from '../../pacman/pacman-turn.ts';
import { type GameEvent, NO_EVENTS } from '../game-event.ts';
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
 * Pac-Man's frame: the eating freeze, then one step.
 *
 * A thin adapter, deliberately. Every rule it needs already exists and is
 * green — `move-actor.ts` owns the sub-pixel carry, the wall stop and the
 * tunnel wrap; `pacman-turn.ts` owns the queued turn; `speed.ts` owns the one
 * conversion from an arcade percentage into sub-pixels; the `LevelSpec` owns
 * the number. This file's whole job is to decide WHETHER Pac-Man moves and to
 * hand those parts to each other, which is why it is short and why nothing in
 * it is a rule of its own.
 *
 * The one piece of gameplay that lives here rather than in a rules module is
 * the freeze, and it is the most important thing in the file. A dot costs
 * Pac-Man one frame of movement and an energizer three
 * (docs/ARCADE-REFERENCE.md section 8.2), which the Dossier explains as being
 * _"just enough for a following ghost to overtake him."_ `eat()` REPORTS that
 * count; this system is what spends it. Delete the freeze and Pac-Man keeps his
 * level-1 80% against the ghosts' 75% forever, so a player who simply holds a
 * direction can never be caught from behind and a full board stops being
 * dangerous.
 */
export const pacmanSystem: System = {
  id: SystemId.Pacman,

  /**
   * One frame of Pac-Man.
   *
   * Three decisions, in the order they are written, because that order IS the
   * behaviour:
   *
   * 1. **Only `playing` simulates.** The READY! countdown, the death animation
   *    and the maze flash are phases in which time passes and the world does
   *    not (section 7). The early return is `unchanged(state)` — the same
   *    object, never a copy — because `runSystems` threads state by reference
   *    and identity is asserted downstream.
   * 2. **A pending freeze costs the whole frame.** The counter comes down and
   *    nothing else happens: no step, no banked sub-pixels, no animation.
   *    `animationFrame` counts the frames Pac-Man was actually simulated, so
   *    the mouth holds its pose through the bite rather than chewing on a
   *    Pac-Man who is not moving.
   * 3. **Otherwise he moves**, at the level's speed and under his own turn
   *    policy, with `mayPassDoor: false` — the ghost-house gate is the one tile
   *    in the maze Pac-Man may never cross (`maze.ts`).
   *
   * `pendingDirection` is mirrored into `actor.queued` here because a
   * `TurnPolicy` is handed a `TurnContext`, which carries the `Actor` and never
   * the `Pacman`, so `actor.queued` is the only queue the turn rule can see
   * (`pacman.ts`). It is mirrored with `??` rather than assigned, and the
   * difference is load-bearing: section 8.4 says a queued direction "persists
   * indefinitely until it is taken or overwritten — it never expires", so
   * copying an absent input over a live request would expire it, and the turn a
   * player pressed a corridor early would be thrown away the moment their thumb
   * came off the stick.
   *
   * The move's `enteredTile` is deliberately dropped. Eating happens one step
   * later in the pipeline and reads the tile Pac-Man is standing on, so this
   * system never needs to know that pellets exist.
   */
  run(state: GameState, ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
    if (state.phase !== RoundPhase.Playing) {
      return unchanged(state);
    }

    const { pacman } = state;
    if (pacman.stopFrames > 0) {
      return {
        state: { ...state, pacman: { ...pacman, stopFrames: pacman.stopFrames - 1 } },
        events: NO_EVENTS,
      };
    }

    const { actor } = moveActor(
      {
        actor: { ...pacman.actor, queued: pacman.pendingDirection ?? pacman.actor.queued },
        maze: ctx.maze,
        stepSubPixels: speedSubPixels(ctx.spec.pacmanSpeed),
        mayPassDoor: false,
      },
      pacmanTurnPolicy,
    );

    return {
      state: { ...state, pacman: { ...pacman, actor, animationFrame: pacman.animationFrame + 1 } },
      events: NO_EVENTS,
    };
  },
};
