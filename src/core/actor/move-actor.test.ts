import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ALL_DIRECTIONS, Direction, opposite, toUnitVector } from '../geometry/direction.ts';
import type { Tile } from '../geometry/tile.ts';
import type { Vector2 } from '../geometry/vector.ts';
import type { GhostId } from '../ghost/ghost-id.ts';
import type { Maze } from '../maze/maze.ts';
import type { TileKind } from '../maze/tile-kind.ts';
import { createRng } from '../rng/rng.ts';

import { type Actor, type MoveResult, type TurnContext, type TurnPolicy } from './actor.ts';
import { moveActor } from './move-actor.ts';

/**
 * The movement engine: sub-pixel carry, cornering, the wall stop and the
 * tunnel wrap.
 *
 * One engine moves all five actors. Ghost AI and Pac-Man's input handling
 * supply a TurnPolicy and never touch geometry, so everything in this file is
 * about pixels and tiles and nothing in it is about pellets, targets or score.
 *
 * UNITS AND ORACLE FOR THE WHOLE FILE.
 *   - The board is a grid of 8x8 pixel tiles (docs/ARCADE-REFERENCE.md, and
 *     docs/ARCHITECTURE.md's decision to keep core in true arcade units). Tile
 *     (col, row) covers pixels x in [col*8, col*8+7]; its CENTRE pixel is
 *     (col*8 + 4, row*8 + 4). Turn decisions happen on that one pixel.
 *   - A pixel is 256 sub-pixels, and a frame's travel is a whole number of
 *     sub-pixels (docs/ARCHITECTURE.md). A frame therefore emits
 *     floor((carry + step) / 256) whole pixels and banks the remainder.
 *   Every expected number below is that arithmetic done by hand and written
 *   out as a literal. Nothing is imported from the implementation to build an
 *   expectation, and no expectation is a tolerance: this design exists so that
 *   `toBe` is always available and `toBeCloseTo` is never needed.
 *
 * WHY THE FIXTURES ARE LOCAL. `tiny-maze` (slice s02) will offer hand-drawn
 * boards, but a movement test should show its own corridor: the ASCII is three
 * lines long and makes every expected pixel checkable by eye. The tiny parser
 * below is also a deliberately INDEPENDENT oracle — the property test asks it,
 * not the production maze module, whether a tile is a wall.
 */

/** Arcade tile size, in pixels. */
const TILE_PIXELS = 8;
/** Half a tile: the offset from a tile's top-left corner to its centre pixel. */
const CENTRE_OFFSET = 4;

const KIND_BY_CHAR: Readonly<Record<string, TileKind>> = {
  '#': 'wall',
  '.': 'open',
  T: 'tunnel',
};

/**
 * Read one tile out of an ASCII fixture.
 *
 * Off the grid reads as wall, exactly as the real `kindAt` will: that is what
 * lets movement code ask about a neighbouring tile without a bounds check.
 * Characters are read with charAt in an index loop rather than by spreading
 * the string, which the lint rules forbid.
 */
function kindAtFixture(rows: readonly string[], tile: Tile): TileKind {
  const row = rows[tile.row];
  if (row === undefined || tile.col < 0 || tile.col >= row.length) {
    return 'wall';
  }
  return KIND_BY_CHAR[row.charAt(tile.col)] ?? 'wall';
}

function isWalkableFixture(rows: readonly string[], tile: Tile): boolean {
  return kindAtFixture(rows, tile) !== 'wall';
}

/** Which tile a pixel position falls in. Independent of the code under test. */
function tileAtPixel(position: Vector2): Tile {
  return {
    col: Math.floor(position.x / TILE_PIXELS),
    row: Math.floor(position.y / TILE_PIXELS),
  };
}

/** The centre pixel of a tile: col*8 + 4, row*8 + 4. */
function centreOfTile(tile: Tile): Vector2 {
  return {
    x: tile.col * TILE_PIXELS + CENTRE_OFFSET,
    y: tile.row * TILE_PIXELS + CENTRE_OFFSET,
  };
}

/**
 * Turn an ASCII fixture into a Maze.
 *
 * Only `columns`, `rows`, `tiles` and `tunnelRow` matter to movement, so the
 * remaining fields are filled with legal placeholders: an actor's step does not
 * depend on where the pellets or the scatter corners are, and a fixture that
 * pretended otherwise would be lying about what is under test.
 */
function mazeFrom(rows: readonly string[], tunnelRow: number): Maze {
  const firstRow = rows[0];
  if (firstRow === undefined) {
    throw new Error('a fixture needs at least one row');
  }
  const columns = firstRow.length;
  const tiles: TileKind[] = [];
  for (const row of rows) {
    if (row.length !== columns) {
      throw new Error(
        `ragged fixture row: expected ${String(columns)} columns, got ${String(row.length)}`,
      );
    }
    for (let col = 0; col < columns; col += 1) {
      const kind = KIND_BY_CHAR[row.charAt(col)];
      if (kind === undefined) {
        throw new Error(`unknown fixture character '${row.charAt(col)}'`);
      }
      tiles.push(kind);
    }
  }

  const origin: Tile = { col: 1, row: 1 };
  const everyGhost: Readonly<Record<GhostId, Tile>> = {
    blinky: origin,
    pinky: origin,
    inky: origin,
    clyde: origin,
  };

  return {
    columns,
    rows: rows.length,
    tiles,
    pelletTiles: [],
    powerPelletTiles: [],
    noUpTiles: new Set<number>(),
    pacmanSpawn: origin,
    ghostSpawns: everyGhost,
    scatterTargets: everyGhost,
    houseDoorTile: origin,
    houseCentreTile: origin,
    fruitTile: origin,
    tunnelRow,
  };
}

/** A straight corridor: `openTiles` open tiles on row 1, walled all round. */
function corridorRows(openTiles: number): readonly string[] {
  return ['#'.repeat(openTiles + 2), `#${'.'.repeat(openTiles)}#`, '#'.repeat(openTiles + 2)];
}

/**
 * The turn policy these tests drive the engine with.
 *
 * Pac-Man's real policy arrives in slice s07; this one states the same two
 * rules in five lines so that the ENGINE's behaviour is what fails when
 * something is wrong:
 *   - a reversal is legal wherever the actor stands;
 *   - any other turn is taken only on a tile centre, and only into a tile that
 *     is not a wall;
 *   - otherwise the actor keeps facing the way it was.
 * Note it consults `ctx.atTileCentre` and `ctx.tile` — so a mover that reports
 * either of those wrongly produces a wrong position here, which is exactly the
 * coupling these tests exist to check.
 */
function testTurnPolicy(rows: readonly string[]): TurnPolicy {
  return (ctx: TurnContext): Direction => {
    const { queued, facing } = ctx.actor;
    if (queued === null) {
      return facing;
    }
    if (queued === opposite(facing)) {
      return queued;
    }
    if (!ctx.atTileCentre) {
      return facing;
    }
    const step = toUnitVector(queued);
    const ahead: Tile = { col: ctx.tile.col + step.x, row: ctx.tile.row + step.y };
    return isWalkableFixture(rows, ahead) ? queued : facing;
  };
}

/** An actor standing on the centre pixel of a tile. */
function actorAtTileCentre(tile: Tile, facing: Direction, queued: Direction | null): Actor {
  return { position: centreOfTile(tile), facing, queued, carrySubPixels: 0 };
}

/** Run `frames` frames at a constant speed, collecting every frame's result. */
function drive(
  rows: readonly string[],
  maze: Maze,
  start: Actor,
  stepSubPixels: number,
  frames: number,
): readonly MoveResult[] {
  const turn = testTurnPolicy(rows);
  const results: MoveResult[] = [];
  let actor = start;
  for (let frame = 0; frame < frames; frame += 1) {
    const result = moveActor({ actor, maze, stepSubPixels, mayPassDoor: false }, turn);
    results.push(result);
    actor = result.actor;
  }
  return results;
}

/**
 * The result of frame `frame`, counting from 1 so a test reads like a timeline.
 *
 * It THROWS on a missing frame rather than returning undefined. That matters:
 * `expect(results[7]?.actor.position).toEqual(other?.position)` passes when
 * both sides are undefined, which is a test that checks nothing while looking
 * like a test that checks something.
 */
function frameAt(results: readonly MoveResult[], frame: number): MoveResult {
  const result = results[frame - 1];
  if (result === undefined) {
    throw new Error(`no frame ${String(frame)} in a run of ${String(results.length)} frames`);
  }
  return result;
}

describe('moveActor', () => {
  describe('sub-pixel carry', () => {
    /*
     * TYPE: unit
     * WHY THIS TYPE: A frame-by-frame timeline is the whole point — the claim
     *   is about WHICH frame a pixel appears on, and only an explicit list of
     *   frames can state that. A property test would have to restate the
     *   division it is checking, which is a test with no oracle.
     * MEASURES: That an actor slower than one pixel per frame still moves, and
     *   that the carry accumulates across frames and emits a whole pixel
     *   exactly when the running total reaches 256.
     * ORACLE: The sub-pixel speed model of docs/ARCHITECTURE.md applied to a
     *   half-pixel-per-frame step — 128 sub-pixels against the 256 in a pixel,
     *   which is also a real arcade speed: the level-1 tunnel ghost's 40% of
     *   FULL_SPEED = 320 is exactly 128 sub-pixels per frame. Frame 1
     *   banks 128 and moves nothing; frame 2 reaches 256, emits one pixel and
     *   banks 0; and so on, alternating. Starting from the centre of tile
     *   (1, 1), x = 1*8 + 4 = 12, the positions are 12, 13, 13, 14, 14, 15.
     * CATCHES: The carry discarded at the end of each frame — every actor
     *   below 100% speed then never moves at all. Or the opposite rounding, so
     *   any non-zero speed moves a whole pixel every frame and every speed
     *   difference in the arcade table silently vanishes: ghosts in the tunnel
     *   would be as fast as Cruise Elroy.
     * LOAD-BEARING: yes
     */
    it('moves a whole pixel on exactly the frame the banked carry reaches 256', () => {
      const rows = corridorRows(6);
      const maze = mazeFrom(rows, -1);
      const start = actorAtTileCentre({ col: 1, row: 1 }, Direction.Right, null);

      const results = drive(rows, maze, start, 128, 6);

      /** frame -> the exact x and the exact carry left over. Hand-computed. */
      const expectedTimeline = [
        { x: 12, carrySubPixels: 128 },
        { x: 13, carrySubPixels: 0 },
        { x: 13, carrySubPixels: 128 },
        { x: 14, carrySubPixels: 0 },
        { x: 14, carrySubPixels: 128 },
        { x: 15, carrySubPixels: 0 },
      ];

      /*
       * Without this, an empty `expectedTimeline` would make the loop body
       * never run and the test pass while checking nothing — the vacuous pass
       * described in docs/TDD-FINDINGS.md.
       */
      expect.assertions(expectedTimeline.length * 2);
      for (const [index, expected] of expectedTimeline.entries()) {
        const { actor } = frameAt(results, index + 1);
        expect(actor.position).toEqual({ x: expected.x, y: 12 });
        expect(actor.carrySubPixels).toBe(expected.carrySubPixels);
      }
    });

    /*
     * TYPE: unit
     * WHY THIS TYPE: Six hundred iterations of pure integer arithmetic still
     *   run in under a millisecond, so the cheapest type is also the right one.
     *   Exactness is the entire point: a tolerance of even one pixel would hide
     *   precisely the accumulating error this test exists to detect.
     * MEASURES: Total displacement over ten seconds of continuous play, and
     *   the exact carry left at the end of it.
     * ORACLE: The stated carry model of docs/ARCHITECTURE.md, as integer
     *   arithmetic. The step is an INPUT here, not an expectation: 205
     *   sub-pixels per frame is chosen precisely because it shares no factor
     *   with 256, so the carry lands on a different remainder on all but one
     *   frame in 256 and any rounding slip shows up as a whole missing pixel.
     *   (It is deliberately NOT any arcade percentage — those live in
     *   speed.test.ts, where FULL_SPEED = 320 makes level-1 Pac-Man exactly
     *   256 sub-pixels per frame, a clean one pixel per frame that would
     *   exercise no carry at all and make this test vacuous.) The expected
     *   value is then the division done by hand: 600 frames * 205 = 123000
     *   sub-pixels; 123000 / 256 = 480 whole pixels with 120 sub-pixels left
     *   over, so from x = 12 the actor finishes at x = 492 carrying 120.
     * CATCHES: A float accumulator that loses a pixel every few hundred
     *   frames. Live play looks perfect; a committed replay fixture
     *   desynchronises minutes in, and the bug is untraceable because nothing
     *   in the game reports it.
     * LOAD-BEARING: yes
     */
    it('is at an exactly predicted pixel after 600 frames at a fractional speed, with no drift', () => {
      const rows = corridorRows(70);
      const maze = mazeFrom(rows, -1);
      const start = actorAtTileCentre({ col: 1, row: 1 }, Direction.Right, null);

      const results = drive(rows, maze, start, 205, 600);
      const final = frameAt(results, 600);

      expect(final.actor.position).toEqual({ x: 492, y: 12 });
      expect(final.actor.carrySubPixels).toBe(120);
      expect(final.blocked).toBe(false);
    });

    /*
     * TYPE: property
     * WHY THIS TYPE: An invariant over arbitrary speeds and frame counts, which
     *   fast-check covers and a handful of hand-picked speeds cannot. The seed
     *   is written into the call so a failure reproduces exactly, and no clock
     *   or unseeded randomness is involved.
     * MEASURES: The bounds of the sub-pixel accumulator across long randomised
     *   runs at changing speeds.
     * ORACLE: The stated invariant on the Actor record in
     *   docs/ARCHITECTURE.md: carrySubPixels is always in
     *   [0, SUBPIXELS_PER_PIXEL) — never negative, never equal to 256. The
     *   bound is written as the literal 256 rather than imported, so a wrong
     *   constant in the implementation cannot make the test agree with itself.
     * CATCHES: A carry allowed to reach exactly 256, which emits its pixel one
     *   frame late at one particular speed; or a negative carry left behind by
     *   a wall stop, which then swallows the following frame's movement.
     * LOAD-BEARING: no — the do-nothing mover hands back a carry of 0, which
     *   is inside the range. An honest guard: it pins no behaviour, but it
     *   states the precondition every other test in this file assumes, and it
     *   is the shape of invariant a reader should learn to write down.
     */
    it('keeps the carry in [0, 256) after any sequence of speeds', () => {
      const rows = corridorRows(20);
      const maze = mazeFrom(rows, -1);
      const turn = testTurnPolicy(rows);

      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 1024 }), { minLength: 1, maxLength: 40 }),
          (steps) => {
            let actor = actorAtTileCentre({ col: 1, row: 1 }, Direction.Right, null);
            for (const stepSubPixels of steps) {
              actor = moveActor({ actor, maze, stepSubPixels, mayPassDoor: false }, turn).actor;
              expect(actor.carrySubPixels).toBeGreaterThanOrEqual(0);
              expect(actor.carrySubPixels).toBeLessThan(256);
            }
          },
        ),
        { seed: 20_260_811, numRuns: 200 },
      );
    });
  });

  describe('walls', () => {
    /*
     * TYPE: unit
     * WHY THIS TYPE: One corridor, driven for more frames than the distance
     *   needs, asserting the exact final position and the two MoveResult fields
     *   that go with it. The stop, the facing and the flag are one observable
     *   outcome, and `blocked` is published contract — the renderer freezes
     *   Pac-Man's mouth on it — not an internal detail.
     * MEASURES: Where an actor comes to rest in front of a wall, that it says
     *   so, and that it keeps facing the wall.
     * ORACLE: Arcade behaviour: Pac-Man stops with his centre on the last
     *   walkable tile's centre pixel — not overlapping the wall face, and not
     *   short of the centre. The corridor here is open on columns 1..3 with a
     *   wall at column 4, so the resting place is the centre of column 3:
     *   3*8 + 4 = 28. He is still facing right, because a wall does not turn
     *   anybody round.
     * CATCHES: Stopping one pixel early, which leaves the actor permanently
     *   off-centre so isAtTileCentre is never true again and no queued turn
     *   ever fires — Pac-Man jams in the dead end forever. Or `blocked` never
     *   set, so the mouth chomps at a wall indefinitely and the ghost house
     *   logic cannot tell a stuck ghost from a moving one.
     * LOAD-BEARING: yes
     */
    it('stops flush on the last tile centre before a wall, keeps facing and reports blocked', () => {
      const rows = corridorRows(3);
      const maze = mazeFrom(rows, -1);
      const start = actorAtTileCentre({ col: 1, row: 1 }, Direction.Right, null);

      const results = drive(rows, maze, start, 256, 20);

      expect(frameAt(results, 1).blocked).toBe(false);
      expect(frameAt(results, 20).actor.position).toEqual({ x: 28, y: 12 });
      expect(frameAt(results, 20).actor.facing).toBe(Direction.Right);
      expect(frameAt(results, 20).blocked).toBe(true);
    });

    /*
     * TYPE: property
     * WHY THIS TYPE: The one safety invariant of the whole engine, stated over
     *   arbitrary direction and speed sequences. fast-check generates hundreds
     *   of runs and shrinks any violation to a minimal reproduction, which is
     *   worth more than a dozen hand-written corridors.
     *
     *   The directions come from the project's injected Rng (`createRng`),
     *   seeded by a value fast-check generates, rather than from fast-check's
     *   own arbitraries. That is a deliberate trade: shrinking a seed produces
     *   a less readable counterexample than shrinking an array, but it
     *   exercises the same deterministic Rng the ghosts will use, and it keeps
     *   this file's randomness in one injected place. `Math.random` appears
     *   nowhere; core forbids it and a lint rule enforces that.
     * MEASURES: The tile under the actor after EVERY frame of every generated
     *   run, checked against the fixture directly rather than against the
     *   production maze module.
     * ORACLE: Stated invariant of moveActor in docs/ARCHITECTURE.md: an actor's
     *   position is always on a tile that is walkable for its permissions. A
     *   wall tile never is.
     * CATCHES: A turn applied part-way between pixels that places the actor
     *   inside a wall for a single frame before the next step corrects it.
     *   Invisible on screen — but it puts Pac-Man's tile inside a wall on
     *   exactly the frame collision is evaluated, producing deaths nobody can
     *   reproduce.
     * LOAD-BEARING: no — an actor that never moves is never in a wall, so the
     *   do-nothing mover passes. It is a guard, and it must be read together
     *   with the load-bearing movement tests above and below it: they prove
     *   the actor moves, this proves the movement is safe.
     */
    it('never leaves the actor inside a wall, whatever the directions and speeds', () => {
      const rows = ['#######', '#..#..#', '#.###.#', '#.....#', '#.###.#', '#..#..#', '#######'];
      const maze = mazeFrom(rows, -1);
      const turn = testTurnPolicy(rows);

      fc.assert(
        fc.property(
          fc.integer({ min: -1_000_000, max: 1_000_000 }),
          fc.integer({ min: 16, max: 700 }),
          fc.integer({ min: 1, max: 60 }),
          (seed, stepSubPixels, frames) => {
            const rng = createRng(seed);
            let actor = actorAtTileCentre({ col: 1, row: 1 }, Direction.Right, null);

            for (let frame = 0; frame < frames; frame += 1) {
              const requested = ALL_DIRECTIONS[rng.nextInt(ALL_DIRECTIONS.length)];
              if (requested === undefined) {
                throw new Error('ALL_DIRECTIONS must contain four directions');
              }
              const moved = moveActor(
                { actor: { ...actor, queued: requested }, maze, stepSubPixels, mayPassDoor: false },
                turn,
              );
              actor = moved.actor;
              expect(kindAtFixture(rows, tileAtPixel(actor.position))).not.toBe('wall');
            }
          },
        ),
        { seed: 20_260_811, numRuns: 200 },
      );
    });
  });

  describe('turning', () => {
    /**
     * A crossroads: a corridor along row 2 with an opening above and below the
     * junction at column 2.
     *
     *      #####
     *      ##.##
     *      #...#
     *      ##.##
     *      #####
     */
    const crossroadsRows = ['#####', '##.##', '#...#', '##.##', '#####'];

    /*
     * TYPE: unit
     * WHY THIS TYPE: One junction, one exact position, one exact facing. This
     *   is the central behaviour of the movement engine and deserves a named
     *   example with a readable timeline rather than a generated sequence.
     * MEASURES: That the turn lands ON the junction's centre column — the
     *   actor's x never passes 20 — that it is then travelling up, and that
     *   MoveResult.turned reports the change exactly once.
     * ORACLE: Arcade behaviour: a perpendicular direction request is held and
     *   applied at the first point the corridor allows it, which is a tile
     *   centre. Starting at the centre of tile (1, 2), x = 12, y = 20, the
     *   junction centre of tile (2, 2) is x = 2*8 + 4 = 20, reached after 8
     *   frames at one pixel per frame; the remaining 4 of 12 frames travel up
     *   from y = 20 to y = 16.
     * CATCHES: A turn applied one pixel past the centre. The actor is then
     *   permanently off the tile grid, every later junction is missed, and it
     *   eventually walks into a wall it should have turned at — a bug that
     *   surfaces minutes later and nowhere near its cause.
     * LOAD-BEARING: yes
     */
    it('takes a queued turn at the junction centre and never overshoots it', () => {
      const maze = mazeFrom(crossroadsRows, -1);
      const start = actorAtTileCentre({ col: 1, row: 2 }, Direction.Right, Direction.Up);

      const results = drive(crossroadsRows, maze, start, 256, 12);
      const furthestRight = Math.max(...results.map((result) => result.actor.position.x));
      const turningFrames = results.filter((result) => result.turned).length;

      expect(furthestRight).toBe(20);
      expect(frameAt(results, 12).actor.position).toEqual({ x: 20, y: 16 });
      expect(frameAt(results, 12).actor.facing).toBe(Direction.Up);
      expect(turningFrames).toBe(1);
    });

    /*
     * TYPE: unit
     * WHY THIS TYPE: Two timelines, one rule, at two scales — so they belong
     *   in one test. A request made a few pixels early is the "pre-turn
     *   window" that makes the game feel like the arcade; a request held for
     *   fifty-six frames through a corridor with no exit is the same rule with
     *   no expiry. Five lines of ASCII make both situations checkable by eye.
     * MEASURES: That `queued` survives every frame on which it cannot be
     *   satisfied — a handful, and a great many — and is then applied.
     * ORACLE: Arcade cornering behaviour: an input given shortly before a
     *   junction is honoured at the junction rather than demanding
     *   frame-perfect timing, and the last direction pressed persists as the
     *   player's intent until it is satisfied or replaced. Timeline one:
     *   requested at x = 17, three pixels short of the junction centre 20, so
     *   after 8 frames the actor has spent 3 frames reaching the centre and 5
     *   travelling up from y = 20 to y = 15. Timeline two: the only opening is
     *   above column 8, whose centre is 8*8 + 4 = 68; starting at x = 12 that
     *   is 56 frames away, so of 60 frames the last 4 go up from y = 20 to
     *   y = 16 — and at frame 30 the actor must still be heading right, at
     *   x = 12 + 30 = 42.
     * CATCHES: `queued` cleared on any frame it cannot be satisfied. The game
     *   becomes unplayable in a way nobody can name — players report "the
     *   controls feel laggy" and not one test fails. The long-corridor
     *   timeline additionally catches an expiry after N frames, which
     *   reproduces only in long corridors and looks like an input bug.
     * LOAD-BEARING: yes
     */
    it('holds a queued direction until the first junction that allows it, however long that takes', () => {
      const nearMaze = mazeFrom(crossroadsRows, -1);
      const requestedEarly: Actor = {
        position: { x: 17, y: 20 },
        facing: Direction.Right,
        queued: Direction.Up,
        carrySubPixels: 0,
      };

      const nearResults = drive(crossroadsRows, nearMaze, requestedEarly, 256, 8);

      expect(frameAt(nearResults, 8).actor.position).toEqual({ x: 20, y: 15 });
      expect(frameAt(nearResults, 8).actor.facing).toBe(Direction.Up);

      /**
       * A long corridor whose only opening upwards is above column 8.
       *
       *      ############
       *      ########.###
       *      #..........#
       *      ############
       */
      const longRows = ['############', '########.###', '#..........#', '############'];
      const longMaze = mazeFrom(longRows, -1);
      const start = actorAtTileCentre({ col: 1, row: 2 }, Direction.Right, Direction.Up);

      const longResults = drive(longRows, longMaze, start, 256, 60);

      expect(frameAt(longResults, 30).actor.position).toEqual({ x: 42, y: 20 });
      expect(frameAt(longResults, 30).actor.facing).toBe(Direction.Right);
      expect(frameAt(longResults, 60).actor.position).toEqual({ x: 68, y: 16 });
      expect(frameAt(longResults, 60).actor.facing).toBe(Direction.Up);
    });

    /*
     * TYPE: unit
     * WHY THIS TYPE: One corridor, one deliberately off-centre position, one
     *   frame. The rule is an explicit EXCEPTION to the tile-centre rule, so it
     *   has to be stated on its own or it will be quietly lost in a refactor
     *   that "simplifies" turning.
     * MEASURES: That the opposite of the current facing is applied at any
     *   pixel, not only on a centre.
     * ORACLE: Arcade behaviour: Pac-Man turns around instantly wherever he
     *   stands; only perpendicular turns wait for the corridor to open. From
     *   x = 17 — mid-tile, since the centre of column 2 is 20 — one frame at
     *   one pixel per frame going left lands on x = 16.
     * CATCHES: A reversal deferred to the next tile centre, which adds up to
     *   seven pixels of lag to every about-face and makes ghost evasion feel
     *   wrong in exactly the moments it matters most.
     * LOAD-BEARING: yes
     */
    it('reverses immediately mid-corridor, without waiting for a tile centre', () => {
      const rows = corridorRows(6);
      const maze = mazeFrom(rows, -1);
      const midTile: Actor = {
        position: { x: 17, y: 12 },
        facing: Direction.Right,
        queued: Direction.Left,
        carrySubPixels: 0,
      };

      const results = drive(rows, maze, midTile, 256, 1);
      const first = frameAt(results, 1);

      expect(first.actor.position).toEqual({ x: 16, y: 12 });
      expect(first.actor.facing).toBe(Direction.Left);
      expect(first.turned).toBe(true);
    });

    /*
     * TYPE: unit
     * WHY THIS TYPE: A unit at a speed above one pixel per frame. Phrased as
     *   behaviour rather than as "the policy is consulted once per pixel",
     *   deliberately: asserting a call count would pin the implementation and
     *   block every future refactor. The observable consequence is identical
     *   and survives a rewrite.
     * MEASURES: Position, facing and carry after a single frame whose step
     *   crosses a junction centre.
     * ORACLE: Arcade behaviour — turns land on the tile centre regardless of
     *   speed, because movement resolves pixel by pixel within the frame —
     *   plus the carry arithmetic at 640 sub-pixels per frame (2.5 pixels).
     *   From x = 12: frame 1 emits 2 pixels and banks 128 (x = 14); frame 2
     *   emits 3 and banks 0 (x = 17); frame 3 emits 2 and banks 128 (x = 19);
     *   frame 4 emits 3 — the first reaches the junction centre x = 20, where
     *   the turn is taken, so the other two travel UP, from y = 20 to y = 18.
     * CATCHES: A frame-granular mover that evaluates the turn only at the end
     *   of a frame, so at high speed the actor sails past junctions. It would
     *   appear only for Cruise Elroy Blinky and for a ghost's eyes — the two
     *   fastest states — and present as "the ghosts get stuck circling late in
     *   a level", which is nearly impossible to trace back to here.
     * LOAD-BEARING: yes
     */
    it('turns at the tile centre it passed through, even at two and a half pixels per frame', () => {
      const maze = mazeFrom(crossroadsRows, -1);
      const start = actorAtTileCentre({ col: 1, row: 2 }, Direction.Right, Direction.Up);

      const results = drive(crossroadsRows, maze, start, 640, 4);
      const fourth = frameAt(results, 4);

      expect(fourth.actor.position).toEqual({ x: 20, y: 18 });
      expect(fourth.actor.facing).toBe(Direction.Up);
      expect(fourth.actor.carrySubPixels).toBe(0);
    });
  });

  describe('reporting and wrapping', () => {
    /*
     * TYPE: unit
     * WHY THIS TYPE: Five frames, both branches of one field. This single
     *   field is the entire channel through which eating happens, so both the
     *   "entered" and the "did not enter" cases must be pinned. Worth saying
     *   why it is one tile and not a list: at every speed in the arcade table
     *   the per-frame step is far below the 8-pixel tile size, so no actor can
     *   cross two boundaries in one frame.
     * MEASURES: MoveResult.enteredTile on a boundary-crossing frame and on the
     *   frames either side of it.
     * ORACLE: The stated contract of MoveResult in docs/ARCHITECTURE.md:
     *   enteredTile is how a caller learns a pellet might have been eaten,
     *   without moveActor knowing that pellets exist. Column 1 spans pixels
     *   8..15 and column 2 begins at pixel 16, so starting from x = 12 at one
     *   pixel per frame the crossing happens on frame 4 and on no other.
     * CATCHES: enteredTile reported every frame, so a pellet is re-eaten on
     *   each of the eight frames Pac-Man spends crossing its tile and the score
     *   inflates eightfold; or never reported, so nothing is ever eaten and the
     *   board never clears.
     * LOAD-BEARING: yes — the crossing frame is. The three null frames pass
     *   against the do-nothing mover and are guards, kept because a field that
     *   is always set is as broken as a field that is never set.
     */
    it('reports the tile newly entered, and null on every frame that stays put', () => {
      const rows = corridorRows(6);
      const maze = mazeFrom(rows, -1);
      const start = actorAtTileCentre({ col: 1, row: 1 }, Direction.Right, null);

      const results = drive(rows, maze, start, 256, 5);

      expect(frameAt(results, 1).enteredTile).toBeNull();
      expect(frameAt(results, 2).enteredTile).toBeNull();
      expect(frameAt(results, 3).enteredTile).toBeNull();
      expect(frameAt(results, 4).enteredTile).toEqual({ col: 2, row: 1 });
      expect(frameAt(results, 5).enteredTile).toBeNull();
    });

    /*
     * TYPE: unit
     * WHY THIS TYPE: One frame, asserting the exact position AND the exact
     *   carry across the warp. The carry is the part an implementation forgets;
     *   only an exact assertion on it catches the omission, because a
     *   position-only test passes while the bug ships.
     * MEASURES: position and carrySubPixels on the frame that crosses the
     *   board edge on the tunnel row.
     * ORACLE: Arcade behaviour: the tunnel is continuous, so motion through it
     *   is unbroken and the accumulated sub-pixel remainder cannot be reset.
     *   The fixture is 8 columns wide, so the playfield is 8*8 = 64 pixels
     *   across; stepping left from x = 0 reaches x = -1, which is the same
     *   place as x = 63. The carry is hand-computed: 200 banked plus a 192
     *   step is 392, which emits one whole pixel (256) and leaves 136.
     * CATCHES: The carry zeroed at the warp, costing a fraction of a pixel per
     *   transit. Over a level, Pac-Man and the ghosts drift out of the phase
     *   relationship every documented arcade pattern depends on, and the
     *   symptom — "the ghosts behave differently after a few tunnel trips" —
     *   never points here.
     * LOAD-BEARING: yes
     */
    it('wraps across the tunnel edge with the sub-pixel carry preserved', () => {
      /** Tunnel mouths at both ends of row 1; the board is 8 tiles wide. */
      const rows = ['########', 'TT....TT', '########'];
      const maze = mazeFrom(rows, 1);
      const atLeftEdge: Actor = {
        position: { x: 0, y: 12 },
        facing: Direction.Left,
        queued: null,
        carrySubPixels: 200,
      };

      const results = drive(rows, maze, atLeftEdge, 192, 1);
      const first = frameAt(results, 1);

      expect(first.actor.position).toEqual({ x: 63, y: 12 });
      expect(first.actor.carrySubPixels).toBe(136);
      expect(first.blocked).toBe(false);
    });
  });
});
