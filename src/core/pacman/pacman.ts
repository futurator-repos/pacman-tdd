/**
 * Pac-Man: an `Actor` plus the three things only he has.
 *
 * SIGNATURE-ONLY STUB — slice s07 RED phase. No behaviour, inert values only.
 * `spawnPacman` deliberately returns the WRONG facing and the WRONG position,
 * so the spawn test fails on both rather than accidentally agreeing with a
 * do-nothing implementation (docs/TDD-FINDINGS.md, "the stub is a measuring
 * instrument").
 */
import { type Actor } from '../actor/actor.ts';
import { Direction } from '../geometry/direction.ts';
import { type Maze } from '../maze/maze.ts';

/**
 * Everything about Pac-Man that is not shared with a ghost.
 *
 * `stopFrames` is the eating freeze, and it is the reason Pac-Man cannot
 * outrun the ghosts forever: a dot costs him one frame of movement and an
 * energizer costs him three (docs/ARCADE-REFERENCE.md section 8.2). At level 1
 * he moves at 80% against the ghosts' 75%, so without this field he would be
 * permanently faster than everything chasing him.
 *
 * `pendingDirection` is the INPUT-facing field: slice s10's input-system writes
 * the player's last held direction here, and pacman-system mirrors it into
 * `actor.queued` before moving. The two exist separately because a `TurnPolicy`
 * receives only a `TurnContext` — which carries the `Actor` and not the
 * `Pacman` — so `actor.queued` is the only queue the turn rule can see.
 *
 * `animationFrame` is drawn, never simulated: the renderer reads it rather than
 * keeping a counter of its own, which is what stops the picture and the rules
 * from disagreeing about what Pac-Man is doing.
 */
export interface Pacman {
  readonly actor: Actor;
  readonly pendingDirection: Direction | null;
  readonly stopFrames: number;
  readonly animationFrame: number;
}

/** Pac-Man at the start of a life, on the maze's `P` tile. */
export function spawnPacman(_maze: Maze): Pacman {
  return {
    actor: {
      position: { x: 0, y: 0 },
      facing: Direction.Right,
      queued: null,
      carrySubPixels: 0,
    },
    pendingDirection: null,
    stopFrames: 0,
    animationFrame: 0,
  };
}
