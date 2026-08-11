/**
 * Pac-Man: an `Actor` plus the three things only he has.
 *
 * The split matters more than it looks. Everything positional is in the
 * `Actor`, so the movement engine serves him and the four ghosts unchanged;
 * everything below is the part no ghost has.
 */
import { type Actor } from '../actor/actor.ts';
import { Direction } from '../geometry/direction.ts';
import { centreOf } from '../geometry/tile.ts';
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

/**
 * Pac-Man at the start of a life, on the maze's `P` tile.
 *
 * Two decisions are recorded in docs/ARCADE-REFERENCE.md section 8.3 as this
 * repo's conventions rather than as Dossier facts, and both are asserted by a
 * test, so they must be read together. He faces LEFT, which the Dossier never
 * states — it is corroborated only by the original's start-of-life sprite. And
 * he stands on the CENTRE pixel of the tile where the arcade uses a tile
 * boundary, because every turn decision in `move-actor.ts` is taken on a centre
 * pixel: a spawn half a tile out of phase would make the first turn of every
 * life behave differently from every later one.
 *
 * Takes the maze rather than a tile so that the `P` in the authored layout is
 * the single source of the spawn, and a fixture board spawns correctly with no
 * caller passing a coordinate of its own.
 */
export function spawnPacman(maze: Maze): Pacman {
  return {
    actor: {
      position: centreOf(maze.pacmanSpawn),
      facing: Direction.Left,
      queued: null,
      carrySubPixels: 0,
    },
    pendingDirection: null,
    stopFrames: 0,
    animationFrame: 0,
  };
}
