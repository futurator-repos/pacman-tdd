import { type TurnPolicy, tileOf } from '../../actor/actor.ts';
import { moveActor } from '../../actor/move-actor.ts';
import { type Direction, opposite } from '../../geometry/direction.ts';
import { type Tile, tileEquals } from '../../geometry/tile.ts';
import { chooseDirection } from '../../ghost/choose-direction.ts';
import { chooseFrightenedDirection } from '../../ghost/frightened-turn.ts';
import { GHOST_ORDER, GhostId } from '../../ghost/ghost-id.ts';
import { ghostSpeed } from '../../ghost/ghost-speed.ts';
import { type Ghost, GhostPhase, isFrightened } from '../../ghost/ghost.ts';
import { type TargetContext } from '../../ghost/targeting/target-context.ts';
import { targetFor } from '../../ghost/targeting/target-for.ts';
import { type Maze, kindAt, walkableNeighbours } from '../../maze/maze.ts';
import { currentMode } from '../../rules/mode-schedule.ts';
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
 * The frame in which the four personalities become four ghosts walking.
 *
 * A thin adapter, and it is worth saying which five parts it is thin over,
 * because between them they are the whole of ghost movement and every one of
 * them is already green: `targeting/target-for.ts` says where a ghost WANTS to
 * go, `choose-direction.ts` turns that into a turn, `frightened-turn.ts`
 * replaces the decision with a draw, `ghost-speed.ts` picks the step and
 * `move-actor.ts` spends it. Nothing here re-decides any of that. What this file
 * owns is the JOINTS — which of the two turn rules applies, which flag each part
 * is handed, and in what order the four ghosts are served.
 *
 * WHAT THIS SYSTEM DOES NOT DO, stated first because the boundary is the
 * surprising part: it moves the ghosts that are on the BOARD. A ghost waiting
 * inside the house, or walking out through the gate, belongs to the house system
 * — docs/ARCADE-REFERENCE.md section 12 is an entire release protocol, and a
 * ghost that navigated its own way out would make every counter in it
 * decorative. That is also why a returning pair of eyes is handed straight to
 * phase `InHouse` here: it rejoins the queue and leaves again when the house
 * says so.
 */

/**
 * Is this ghost this system's business?
 *
 * The two phases that ARE are the two in which a ghost is navigating the maze:
 * hunting it, or crossing it as a pair of eyes. `InHouse`, `LeavingHouse` and
 * `EnteringHouse` are the house's, per the note above.
 */
function isOnTheBoard(ghost: Ghost): boolean {
  return ghost.phase === GhostPhase.Hunting || ghost.phase === GhostPhase.Eyes;
}

/**
 * The exits a frightened ghost draws from, in `ALL_DIRECTIONS` order.
 *
 * Filtering here rather than inside `frightened-turn.ts` is what keeps that
 * module's contract — EXACTLY ONE DRAW PER DECISION — statable at all: the walls
 * and the reversal are removed before the draw, so nothing is ever drawn and
 * rejected (docs/ARCADE-REFERENCE.md section 10).
 *
 * The fallback is section 9.1's dead end, and it is the same preference-not-law
 * shape `chooseDirection` uses: dropping the reversal can leave nothing at all,
 * and an empty list would reach `rng.nextInt(0)`, which throws. A crash
 * mid-frame in a pocket the arcade walks into routinely is a worse answer than
 * turning round.
 */
function frightenedExits(
  maze: Maze,
  tile: Tile,
  facing: Direction,
  mayPassDoor: boolean,
): readonly Direction[] {
  const exits = walkableNeighbours(maze, tile, mayPassDoor);
  const onward = exits.filter((exit) => exit.direction !== opposite(facing));
  return (onward.length > 0 ? onward : exits).map((exit) => exit.direction);
}

/** One ghost's frame: where it ended up, and whether that was the front door. */
interface GhostStep {
  readonly ghost: Ghost;
  readonly returnedHome: boolean;
}

/**
 * Advance one ghost by one frame.
 *
 * THE ORDER OF THE TWO QUESTIONS IN THE POLICY IS THE BEHAVIOUR, and it is eyes
 * before fright. A ghost eaten mid-fright is phase `Eyes` with its fright timer
 * still running, because fright is a timer that runs alongside the phase and
 * never replaces it (`ghost/ghost.ts`). Asked the other way round, those eyes
 * would wander at random, never reach the house, and the level would quietly
 * continue one ghost short. `ghost-speed.ts` orders the same pair the same way
 * for the same reason (docs/ARCADE-REFERENCE.md section 11.1).
 *
 * THE DECISION IS TAKEN ONLY ON A TILE CENTRE. `moveActor` asks the policy
 * before every pixel — that is what stops a fast actor sailing past a junction —
 * so the centre test is what turns "asked constantly" into the arcade's one
 * decision per tile (section 9.2). Without it a frightened ghost would draw from
 * the Rng on every pixel of its life, and no replay would ever reproduce.
 *
 * `mayPassDoor` IS THE PHASE, in one expression: the gate is crossed by eyes
 * going home and by nobody else here. Hunting ghosts are refused it, or a ghost
 * whose target lies beyond the house dives into it mid-chase and mills about
 * inside.
 *
 * The speed is chosen once per frame from the tile the ghost STARTS on, which is
 * how `ghost-speed.ts` asks to be called — a `TileKind`, not a board — and it is
 * why the tunnel slows a ghost the moment it is in the tunnel rather than a
 * frame later.
 */
function stepGhost(ghost: Ghost, ctx: FrameContext, targets: TargetContext): GhostStep {
  const eyes = ghost.phase === GhostPhase.Eyes;

  const policy: TurnPolicy = (turn) => {
    if (!turn.atTileCentre) {
      return turn.actor.facing;
    }
    if (!eyes && isFrightened(ghost)) {
      return chooseFrightenedDirection(
        ctx.rng,
        frightenedExits(ctx.maze, turn.tile, turn.actor.facing, eyes),
      );
    }
    return chooseDirection({
      maze: ctx.maze,
      tile: turn.tile,
      facing: turn.actor.facing,
      target: targetFor(ghost, targets),
      mayPassDoor: eyes,
    });
  };

  const { actor } = moveActor(
    {
      actor: ghost.actor,
      maze: ctx.maze,
      stepSubPixels: ghostSpeed({
        ghost,
        spec: ctx.spec,
        tileKind: kindAt(ctx.maze, tileOf(ghost.actor)),
      }),
      mayPassDoor: eyes,
    },
    policy,
  );

  /* Arrival is ENTERING the gate tile, not reaching its centre: eyes cover
     nearly two pixels a frame, so a ghost that had to land on one exact pixel
     would sail past the house and circle the board forever. */
  const returnedHome = eyes && tileEquals(tileOf(actor), ctx.maze.houseDoorTile);
  return {
    ghost: returnedHome ? { ...ghost, actor, phase: GhostPhase.InHouse } : { ...ghost, actor },
    returnedHome,
  };
}

/** The four ghosts as they stand part-way through a frame, plus what they said. */
interface GhostFrame {
  readonly ghosts: Readonly<Record<GhostId, Ghost>>;
  readonly events: readonly GameEvent[];
}

/**
 * The ghosts' step of a frame.
 *
 * It runs after the house has decided who may leave and before the second
 * collision check — the order `SystemId` states — and both sides of that
 * placement are load-bearing: a ghost
 * released this frame is already free to walk when this system reaches it, and a
 * ghost that walks onto Pac-Man is judged in the same frame it arrives rather
 * than in the next one. See the module note above for what it is thin over.
 */
export const ghostSystem: System = {
  id: SystemId.Ghost,

  /**
   * One frame of all four ghosts.
   *
   * THE FOLD RUNS OVER `GHOST_ORDER`, NEVER OVER THE RECORD. `Object.values`
   * would give the same four ghosts today and its order is a property of how the
   * record happened to be built rather than a decision anybody made — while the
   * order the seeded Rng is consumed in is a REPLAY CONTRACT
   * (`ghost/ghost-id.ts`). A reordering there desynchronises every recorded game
   * from its first power pellet, and because it only shows during fright it
   * looks intermittent.
   *
   * THE TARGET CONTEXT IS BUILT ONCE, so all four ghosts steer by one snapshot
   * of the world. Rebuilt per ghost it would matter only in that Inky would see
   * a Blinky who had already taken his pixel this frame; fixing the snapshot is
   * a frame-ordering decision made here, out loud, rather than an accident of
   * where the loop happens to read from.
   *
   * TWO EARLY EXITS RETURN THE STATE BY IDENTITY rather than a copy of it, and
   * both matter downstream: `runSystems` threads state by reference and a
   * defensive spread here would be invisible in every value assertion while
   * quietly defeating every `toBe` in the pipeline. The first is the phase gate —
   * the READY! pause, the death animation and the maze flash are phases in which
   * time passes and the world does not (section 7). The second is the frame on
   * which no ghost was on the board at all, which is an ordinary situation: a
   * player who clears the quartet mid-fright has all four waiting in the house.
   */
  run(state: GameState, ctx: FrameContext, _incoming: readonly GameEvent[]): SystemResult {
    if (state.phase !== RoundPhase.Playing) {
      return unchanged(state);
    }

    const targets: TargetContext = {
      maze: ctx.maze,
      pacmanTile: tileOf(state.pacman.actor),
      pacmanFacing: state.pacman.actor.facing,
      blinkyTile: tileOf(state.ghosts[GhostId.Blinky].actor),
      mode: currentMode(state.modes, ctx.spec),
    };

    const frame = GHOST_ORDER.reduce<GhostFrame>(
      (current, id) => {
        const ghost = current.ghosts[id];
        if (!isOnTheBoard(ghost)) {
          return current;
        }
        const step = stepGhost(ghost, ctx, targets);
        return {
          ghosts: { ...current.ghosts, [id]: step.ghost },
          events: step.returnedHome
            ? [...current.events, { kind: 'ghostReturnedHome', ghost: id }]
            : current.events,
        };
      },
      { ghosts: state.ghosts, events: NO_EVENTS },
    );

    if (frame.ghosts === state.ghosts) {
      return unchanged(state);
    }
    return { state: { ...state, ghosts: frame.ghosts }, events: frame.events };
  },
};
