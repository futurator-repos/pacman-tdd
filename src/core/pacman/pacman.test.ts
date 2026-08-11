import { describe, expect, it } from 'vitest';

import { type Actor, type MoveResult } from '../actor/actor.ts';
import { moveActor } from '../actor/move-actor.ts';
import { Direction } from '../geometry/direction.ts';
import { type Maze } from '../maze/maze.ts';
import { corridorMaze, crossroadsMaze } from '../testing/tiny-maze.ts';

import { pacmanTurnPolicy } from './pacman-turn.ts';
import { spawnPacman } from './pacman.ts';

/**
 * Pac-Man, moving: the turn rule and the movement engine, wired together.
 *
 * `pacman-turn.test.ts` pins the RULE against hand-built contexts. This file
 * pins what a player actually experiences, which needs frames: a direction
 * pressed early is remembered and lands at the corner, an about-face happens
 * now, and walking into a wall stops him without changing where he is looking.
 * These are integration tests by the definition in docs/TDD-CHARTER.md — two
 * modules cooperating — and they are still pure arithmetic, so they cost
 * microseconds and stay at the bottom of the pyramid.
 *
 * SPEED, AND WHY EVERY NUMBER BELOW IS A WHOLE PIXEL.
 *   docs/ARCADE-REFERENCE.md section 3: level-1 Pac-Man moves at 80% of full
 *   speed. Section 2: 100% is 1.25 pixels per frame, and a pixel is 256
 *   sub-pixels, so full speed is 320 sub-pixels per frame. Therefore
 *   0.8 x 320 = 256 sub-pixels — EXACTLY one pixel per frame. The reference
 *   calls this out as the independent check on the whole sub-pixel scheme.
 *   Writing 256 as a literal here rather than calling `speedSubPixels(0.8)`
 *   keeps the expectation independent of the arithmetic the implementation
 *   uses, exactly as docs/ARCADE-REFERENCE.md's note for test authors requires.
 *
 * A tile is 8 pixels and its centre is (col*8 + 4, row*8 + 4), so with one
 * pixel per frame the frame counts below are simply pixel distances, and a
 * reader can check them by counting characters in the fixture.
 */

/** Level-1 Pac-Man: 80% of 320 sub-pixels, which is exactly one pixel a frame. */
const ONE_PIXEL_PER_FRAME = 256;

/**
 * Run `frames` frames and return the LAST frame's result.
 *
 * No assertion inside the loop, deliberately: an assertion in a loop passes
 * vacuously when the loop never runs (docs/TDD-FINDINGS.md, failure mode 2).
 * The tests assert afterwards, on the value the fold produced.
 */
function runFrames(maze: Maze, start: Actor, frames: number): MoveResult {
  let result: MoveResult = { actor: start, enteredTile: null, blocked: false, turned: false };
  for (let frame = 0; frame < frames; frame += 1) {
    result = moveActor(
      {
        actor: result.actor,
        maze,
        stepSubPixels: ONE_PIXEL_PER_FRAME,
        mayPassDoor: false,
      },
      pacmanTurnPolicy,
    );
  }
  return result;
}

describe('spawnPacman', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One construction, compared whole with toEqual. Comparing the
   *   whole record rather than four separate fields is the point: it also
   *   asserts that nothing ELSE is on a freshly spawned Pac-Man — no leftover
   *   freeze, no stale queued direction from the life before.
   * MEASURES: Every field of `Pacman` immediately after a spawn, on the
   *   corridor fixture whose `P` sits at tile (4,3).
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.3 — Pac-Man begins each life on
   *   the `P` tile, centred, FACING LEFT, stationary, with nothing queued and
   *   no freeze pending. That section marks the facing as a [repo convention]
   *   rather than a Dossier fact, because the Dossier states no initial facing;
   *   this test therefore asserts a documented decision, and it says so. The
   *   pixel is (4*8 + 4, 3*8 + 4) = (36, 28), from the tile geometry pinned in
   *   `tile.test.ts`.
   * CATCHES: A spawn on the tile's top-left corner instead of its centre. Every
   *   turn decision in the game is taken on a centre pixel, so Pac-Man would be
   *   permanently four pixels out of phase: the first turn of every life would
   *   behave differently from every later one, and he would never line up with
   *   a junction again.
   * LOAD-BEARING: yes (the stub spawns at (0,0) facing right).
   */
  it('places Pac-Man centred on the P tile, facing left, with nothing queued or pending', () => {
    expect(spawnPacman(corridorMaze())).toEqual({
      actor: {
        position: { x: 36, y: 28 },
        facing: Direction.Left,
        queued: null,
        carrySubPixels: 0,
      },
      pendingDirection: null,
      stopFrames: 0,
      animationFrame: 0,
    });
  });
});

describe('Pac-Man moving through the maze', () => {
  /*
   * TYPE: integration
   * WHY THIS TYPE: This is the behaviour a player calls "responsive", and it
   *   cannot be seen in a single policy call: the request is made twenty-four
   *   frames before it becomes legal and must survive every one of them. It
   *   needs the mover and the policy together, which is what makes it an
   *   integration test rather than a unit — but it is still pure core, so it
   *   belongs here and not in an e2e test.
   * MEASURES: Position and facing after 24 frames (still travelling right,
   *   exactly on the junction centre) and after 25 (one pixel up, now facing
   *   up), plus the `turned` flag on each of those frames.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4 — a queued direction is
   *   retried every pixel and applied at the first tile centre where it is
   *   legal, and it persists until then rather than expiring. The arithmetic:
   *   Pac-Man starts on the centre of (2,4) at x = 2*8+4 = 20 and the junction
   *   (5,4) has its centre at x = 5*8+4 = 44, so 24 frames at one pixel each
   *   bring him exactly there; the policy is consulted BEFORE each pixel, so
   *   the 25th frame is the first one that starts on the centre and it is the
   *   frame the turn happens on. On the way he crosses the centres of (3,4)
   *   and (4,4), where up is walled and the request must NOT be dropped.
   * CATCHES: The two opposite failures at once. A policy that clears the queue
   *   when a turn is illegal drops the input and Pac-Man sails past the
   *   junction — the "the controls ate my turn" bug that makes a game feel
   *   broken. A policy that applies the queue without checking the centre turns
   *   him at frame 1 and walks him into the wall above (2,4).
   * LOAD-BEARING: yes (the stub keeps facing right, so frame 25 leaves him at
   *   x = 45 still facing right).
   */
  it('remembers a turn pressed a whole corridor early and takes it at the junction', () => {
    const maze = crossroadsMaze();
    const start: Actor = {
      position: { x: 20, y: 36 },
      facing: Direction.Right,
      queued: Direction.Up,
      carrySubPixels: 0,
    };

    const atTheJunction = runFrames(maze, start, 24);
    expect(atTheJunction.actor.position).toEqual({ x: 44, y: 36 });
    expect(atTheJunction.actor.facing).toBe(Direction.Right);
    expect(atTheJunction.turned).toBe(false);

    const afterTurning = runFrames(maze, start, 25);
    expect(afterTurning.actor.position).toEqual({ x: 44, y: 35 });
    expect(afterTurning.actor.facing).toBe(Direction.Up);
    expect(afterTurning.turned).toBe(true);
  });

  /*
   * TYPE: integration
   * WHY THIS TYPE: The claim is about WHEN, measured in frames, so it needs the
   *   mover. Three frames of travel first, so that the reversal is requested at
   *   a pixel provably not a tile centre (x = 47 is the last pixel of tile
   *   (5,4), whose centre is 44) — a reversal asked for at a centre would prove
   *   nothing, because the ordinary turn rule would also grant it.
   * MEASURES: Position and facing on the single frame after the reversal is
   *   queued.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4 — a reversal is applied
   *   immediately at whatever pixel Pac-Man occupies. Starting on the centre of
   *   (5,4) at x = 44, three frames right put him at x = 47; the next frame
   *   must move him to x = 46, not 48.
   * CATCHES: A reversal that waits for the next tile centre. From x = 47 that
   *   is five more pixels of travel the wrong way and then a turn — the player
   *   pressed left and watched Pac-Man keep going right into a ghost. It is
   *   also the difference between this rule and the ghosts', who may never
   *   reverse of their own accord, so an implementation that shares one turn
   *   rule between them gets caught here.
   * LOAD-BEARING: yes (the stub keeps going right to x = 48).
   */
  it('turns around on the very next frame, mid-corridor, without waiting for a junction', () => {
    const maze = crossroadsMaze();
    const start: Actor = {
      position: { x: 44, y: 36 },
      facing: Direction.Right,
      queued: null,
      carrySubPixels: 0,
    };

    const travelling = runFrames(maze, start, 3);
    expect(travelling.actor.position).toEqual({ x: 47, y: 36 });

    const reversed = runFrames(maze, { ...travelling.actor, queued: Direction.Left }, 1);
    expect(reversed.actor.position).toEqual({ x: 46, y: 36 });
    expect(reversed.actor.facing).toBe(Direction.Left);
  });

  /*
   * TYPE: integration
   * WHY THIS TYPE: The stop is a fact about position, facing and a reported
   *   flag together, and only running frames until after he should have stopped
   *   shows that he stays stopped rather than easing into the wall over several
   *   frames. Twenty frames for a sixteen-pixel journey, on purpose.
   * MEASURES: Position, facing and `blocked` after 20 frames of walking left
   *   into the wall at column 0, with an illegal turn queued the whole way.
   * ORACLE: Arcade behaviour plus the MoveResult contract pinned by
   *   `move-actor.test.ts`: an actor stops flush on the last walkable tile
   *   CENTRE, keeps its facing, and reports blocked. The arithmetic: the centre
   *   of (3,3) is x = 28 and the centre of (1,3) is x = 12, so sixteen frames
   *   of travel and four frames of nothing. Facing matters because the renderer
   *   freezes Pac-Man's mouth on `blocked` and draws him by `facing` — a
   *   Pac-Man who forgot which way he was looking would flip to face right
   *   while pressed against a left-hand wall.
   * CATCHES: A queued direction applied unconditionally at the wall: Pac-Man
   *   would face up into a wall he cannot enter, mouth frozen the wrong way, or
   *   worse, step into it. Also catches a stop that happens off-centre, which
   *   would leave him unable to ever turn again because no turn decision is
   *   taken anywhere but on a centre pixel.
   * LOAD-BEARING: no — a guard, and the reason is exactly the reason the test
   *   plan gives for its sibling: the do-nothing policy returns the current
   *   facing, which is the right answer here, and the wall stop itself belongs
   *   to `move-actor.ts`, which is already implemented. It earns its place as
   *   the only test that shows an ILLEGAL queued direction being held
   *   indefinitely without ever taking effect.
   */
  it('stops flush at the wall, keeps facing left, and reports blocked', () => {
    const maze = corridorMaze();
    const start: Actor = {
      position: { x: 28, y: 28 },
      facing: Direction.Left,
      /* Up is walled at every tile of this corridor, so the request can never
         be granted and must never be acted on. */
      queued: Direction.Up,
      carrySubPixels: 0,
    };

    const result = runFrames(maze, start, 20);

    expect(result.actor.position).toEqual({ x: 12, y: 28 });
    expect(result.actor.facing).toBe(Direction.Left);
    expect(result.blocked).toBe(true);
  });
});
