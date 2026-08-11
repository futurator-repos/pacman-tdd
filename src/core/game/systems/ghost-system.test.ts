import { describe, expect, it } from 'vitest';

import { Direction } from '../../geometry/direction.ts';
import { centreOf } from '../../geometry/tile.ts';
import { GhostId } from '../../ghost/ghost-id.ts';
import { GhostPhase } from '../../ghost/ghost.ts';
import { createScriptedRng } from '../../testing/scripted-rng.ts';
import { buildState } from '../../testing/state-builder.ts';
import { deadEndMaze } from '../../testing/tiny-maze.ts';
import { type GameEvent } from '../game-event.ts';
import { RoundPhase } from '../game-phase.ts';
import { type GameState } from '../game-state.ts';
import { type FrameContext, type SystemResult } from '../system.ts';

import { ghostSystem } from './ghost-system.ts';
import { frameContext } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The ghost system is where the four personalities stop being pure functions
 * and become four ghosts walking around a board. Everything it uses is already
 * green: `targeting/` says where a ghost WANTS to go, `choose-direction.ts`
 * turns that into a direction, `frightened-turn.ts` replaces the decision with
 * a draw, `ghost-speed.ts` picks the step and `move-actor.ts` spends it. This
 * system's whole job is to hand those five parts to each other, four times a
 * frame, IN THE RIGHT ORDER — and every test below is about a joint between two
 * of them, because that is the only place a defect can now live.
 *
 * THE ARITHMETIC EVERY FIXTURE BELOW DEPENDS ON, stated once so no test has to
 * re-derive it. A ghost moves in whole pixels and banks the remainder
 * (`actor/actor.ts`), and one pixel is 256 sub-pixels. At level 1
 * (docs/ARCADE-REFERENCE.md section 11, "Ghost speed selection") one frame is
 * worth 240 sub-pixels hunting, 160 frightened, 128 in the tunnel and 480 as
 * eyes. So a ghost with an empty carry does not move at all on its first
 * hunting frame — 240 < 256 — and a fixture that wants to SEE a ghost move must
 * prime the carry: 16 banked plus 240 is exactly one pixel, and 96 banked plus
 * 160 is exactly one pixel. Every "carrySubPixels" in this file is that priming
 * and nothing more.
 *
 * WHAT THIS SYSTEM IS NOT. It moves the ghosts that are ON THE BOARD — hunting,
 * or a pair of eyes going home. The house is a separate system, so a ghost
 * waiting inside it, or walking out through the gate, is not touched here.
 */
describe('ghostSystem', () => {
  /**
   * Runs `frames` consecutive ghost frames, threading the state and collecting
   * every event, so a multi-frame journey can be asserted ONCE at the end.
   *
   * A helper rather than a loop inside a test, because an assertion inside a
   * loop is the vacuous-pass defect of docs/TDD-FINDINGS.md #2: if the loop body
   * never runs the test passes having checked nothing. There is no assertion in
   * here at all, so there is nothing to be vacuous about.
   */
  function runFrames(state: GameState, ctx: FrameContext, frames: number): SystemResult {
    let current: GameState = state;
    let events: readonly GameEvent[] = [];
    for (let frame = 0; frame < frames; frame += 1) {
      const result = ghostSystem.run(current, ctx, []);
      current = result.state;
      events = [...events, ...result.events];
    }
    return { state: current, events };
  }

  /**
   * TYPE: integration (state builder + the real arcade board + one system).
   * WHY THIS TYPE: the claim is about a LOOP — that the four ghosts are visited
   *   in `GHOST_ORDER` and that each takes exactly one draw. Nothing smaller can
   *   see it: `chooseFrightenedDirection` tested alone knows nothing about who
   *   called it, and the only observable consequence of the order is which ghost
   *   received which value from the stream.
   * MEASURES: that the scripted values are consumed Blinky, Pinky, Inky, Clyde,
   *   one each, and that each ghost's new facing is the exit its own draw names.
   * ORACLE: docs/ARCADE-REFERENCE.md section 10, "Frightened turns" — the legal
   *   exits arrive in `ALL_DIRECTIONS` order (up, left, down, right) and the
   *   draw is `nextInt(legal.length)` used as an INDEX into that list, with
   *   EXACTLY ONE DRAW PER DECISION. Plus `src/core/ghost/ghost-id.ts`, which
   *   pins `GHOST_ORDER` as the order the Rng stream is consumed in.
   *   Worked by hand from the board in `classic-layout.ts`:
   *     Blinky (6,8)   facing left  -> exits up/left/down, reversal absent
   *                                 -> [up,left,down], floor(0.9*3)=2 -> DOWN
   *     Pinky  (21,8)  facing up    -> exits up/down/right, less the reversal
   *                                 -> [up,right],      floor(0.6*2)=1 -> RIGHT
   *     Inky   (6,20)  facing left  -> exits up/left/down/right, less right
   *                                 -> [up,left,down],  floor(0.2*3)=0 -> UP
   *     Clyde  (21,20) facing up    -> exits up/left/down/right, less down
   *                                 -> [up,left,right], floor(0.5*3)=1 -> LEFT
   * CATCHES: iterating `Object.values(state.ghosts)` — whose order is a property
   *   of how the record happened to be built, not a decision anyone made — or
   *   drawing once per frame and sharing the result. Every committed replay then
   *   desynchronises the first time a power pellet is eaten, and because it only
   *   shows during fright it looks intermittent, which is the most expensive
   *   class of bug there is.
   * LOAD-BEARING: yes.
   *
   * WOULD A WRONG IMPLEMENTATION PASS? The four ghosts stand at four DIFFERENT
   * junctions with four different exit lists, and the four answers are four
   * different directions, none of which is the direction that ghost was already
   * facing. Swap any two ghosts in the loop and at least two answers change. A
   * fixture with all four ghosts at one junction would have made every ordering
   * agree, and a fixture where a ghost turns the way it was already facing would
   * have made "never turned at all" indistinguishable from "turned correctly".
   * The script holds exactly four values and `createScriptedRng` throws when it
   * runs out, so a fifth draw is a failure rather than a silent extra.
   */
  it('moves the ghosts in ghost order, spending exactly one random draw on each', () => {
    const frightened = { phase: GhostPhase.Hunting, frightenedFramesLeft: 300 };
    const state = buildState({
      ghosts: {
        [GhostId.Blinky]: {
          ...frightened,
          actor: {
            position: centreOf({ col: 6, row: 8 }),
            facing: Direction.Left,
            carrySubPixels: 96,
          },
        },
        [GhostId.Pinky]: {
          ...frightened,
          actor: {
            position: centreOf({ col: 21, row: 8 }),
            facing: Direction.Up,
            carrySubPixels: 96,
          },
        },
        [GhostId.Inky]: {
          ...frightened,
          actor: {
            position: centreOf({ col: 6, row: 20 }),
            facing: Direction.Left,
            carrySubPixels: 96,
          },
        },
        [GhostId.Clyde]: {
          ...frightened,
          actor: {
            position: centreOf({ col: 21, row: 20 }),
            facing: Direction.Up,
            carrySubPixels: 96,
          },
        },
      },
    });
    const ctx = frameContext({ rng: createScriptedRng([0.9, 0.6, 0.2, 0.5]) });

    const { state: next } = ghostSystem.run(state, ctx, []);

    /* One assertion over all four, so the failure diff names the ghost that got
       the wrong draw instead of stopping at the first one. */
    expect({
      blinky: next.ghosts[GhostId.Blinky].actor.facing,
      pinky: next.ghosts[GhostId.Pinky].actor.facing,
      inky: next.ghosts[GhostId.Inky].actor.facing,
      clyde: next.ghosts[GhostId.Clyde].actor.facing,
    }).toEqual({
      blinky: Direction.Down,
      pinky: Direction.Right,
      inky: Direction.Up,
      clyde: Direction.Left,
    });
  });

  /**
   * TYPE: integration.
   * WHY THIS TYPE: the joint under test is between `targetFor` and the ghost
   *   whose id it was asked about. A unit on `targetFor` proves the four corners
   *   are right; only running the system can prove each ghost was handed its OWN.
   * MEASURES: that in scatter, two ghosts standing on the SAME tile facing the
   *   SAME way leave it in opposite directions.
   * ORACLE: docs/ARCADE-REFERENCE.md section 6.1, "Scatter corners" — Pinky's is
   *   the top-left (2,0) and Inky's the bottom-right (27,30). By section 9, "The
   *   turn decision", each candidate exit is scored by squared distance FROM THE
   *   TILE IT LEADS TO. Out of (6,20) facing left the candidates are up (6,19),
   *   left (5,20) and down (6,21) — right is the reversal:
   *     to Pinky's (2,0):    up 4²+19²=377, left 3²+20²=409, down 4²+21²=457
   *                          -> UP
   *     to Inky's (27,30):   up 21²+11²=562, left 22²+10²=584, down 21²+9²=522
   *                          -> DOWN
   * CATCHES: one target computed per FRAME and shared by all four ghosts — the
   *   easy shape for a loop like this to take. The quartet then moves as a single
   *   blob, scatter stops splitting them to four corners, and the game loses the
   *   breathing space that makes it playable.
   * LOAD-BEARING: yes.
   *
   * WOULD A WRONG IMPLEMENTATION PASS? Both ghosts stand on ONE tile with ONE
   * facing, so the only input that differs is which ghost it is. Blinky's corner
   * (25,0) applied to both would answer UP for both, and Pac-Man's tile applied
   * to both — a system that forgot the mode and always chased — would answer the
   * same for both, whatever it is. Two ghosts, two different answers, is the
   * cheapest possible refutation of "everyone got the same target".
   */
  it('sends each ghost to its own scatter corner, from one tile and one facing', () => {
    const standing = {
      phase: GhostPhase.Hunting,
      actor: {
        position: centreOf({ col: 6, row: 20 }),
        facing: Direction.Left,
        carrySubPixels: 16,
      },
    };
    /* waveIndex 0 is the level's opening scatter (mode-schedule.ts, level 1). */
    const state = buildState({
      modes: { waveIndex: 0 },
      ghosts: { [GhostId.Pinky]: standing, [GhostId.Inky]: standing },
    });

    const { state: next } = ghostSystem.run(state, frameContext(), []);

    expect({
      pinky: next.ghosts[GhostId.Pinky].actor.facing,
      inky: next.ghosts[GhostId.Inky].actor.facing,
    }).toEqual({ pinky: Direction.Up, inky: Direction.Down });
  });

  /**
   * TYPE: integration.
   * WHY THIS TYPE: three modules have to agree — the wave clock says the mode,
   *   `targetFor` dispatches on it, and Pinky's rule computes an offset tile.
   *   The fixture is chosen so that all three plausible wrong answers differ from
   *   the right one, which no unit on any single module can show.
   * MEASURES: that a chasing Pinky steers by the tile FOUR AHEAD of Pac-Man,
   *   overflow included, rather than by Pac-Man's own tile.
   * ORACLE: docs/ARCADE-REFERENCE.md section 6.3, "Pinky — four ahead, including
   *   the overflow bug": while Pac-Man faces up the offset is applied to BOTH
   *   axes, so four ahead of (6,26) facing up is (2,22), not (6,22). Scored by
   *   section 9 from the same candidates as the test above:
   *     to Pinky's real target (2,22):   up 4²+3²=25, left 3²+2²=13, down 4²+1²=17
   *                                      -> LEFT
   *     to Pac-Man's tile (6,26):        up 49, left 1+36=37, down 25 -> DOWN
   *     to a "fixed" (6,22), no overflow: up 9,  left 1+4=5,  down 1   -> DOWN
   *   The level-1 wave list makes index 1 the first chase (section 4).
   * CATCHES: `blinkyTarget` wired in for all four personalities, or the arcade's
   *   up-overflow "corrected" by a later tidy-up. Both remove the pincer that
   *   makes Pinky Pinky, and the second one invalidates every safe spot a player
   *   has ever learned.
   * LOAD-BEARING: yes.
   */
  it('steers a chasing Pinky four tiles ahead of Pac-Man, overflow and all', () => {
    const state = buildState({
      modes: { waveIndex: 1 },
      pacman: { actor: { position: centreOf({ col: 6, row: 26 }), facing: Direction.Up } },
      ghosts: {
        [GhostId.Pinky]: {
          phase: GhostPhase.Hunting,
          actor: {
            position: centreOf({ col: 6, row: 20 }),
            facing: Direction.Left,
            carrySubPixels: 16,
          },
        },
      },
    });

    const { state: next } = ghostSystem.run(state, frameContext(), []);

    expect(next.ghosts[GhostId.Pinky].actor.facing).toBe(Direction.Left);
    /* One pixel left of the centre of (6,20), which is (52,164). Asserted as
       well as the facing because LEFT is also the direction Pinky came in
       facing: without the position, "never moved" and "chose left" would be the
       same observation. */
    expect(next.ghosts[GhostId.Pinky].actor.position).toEqual({ x: 51, y: 164 });
  });

  /**
   * TYPE: integration.
   * WHY THIS TYPE: `mayPassDoor` is a parameter threaded from the ghost's phase
   *   into `chooseDirection`, `walkableNeighbours` and the mover. Passing the
   *   wrong value is invisible in every unit — each of them behaves correctly
   *   for the flag it is handed.
   * MEASURES: that a hunting ghost standing on the tile above the gate does not
   *   take the gate, even when its target is directly beyond it.
   * ORACLE: `src/core/maze/maze.ts` — the door is walkable only with
   *   `mayPassDoor`, which docs/ARCADE-REFERENCE.md section 12 grants to ghosts
   *   ENTERING or LEAVING the house, never to one hunting. From (13,11) facing
   *   down, with Pac-Man on the fruit tile (13,17), section 9's scoring gives:
   *     gate closed:  left (12,11) 1²+6²=37, right (14,11) 1²+6²=37 -> tied, and
   *                   section 9's tie order (up, left, down, right) takes LEFT
   *     gate open:    down (13,12) 0²+5²=25 wins outright              -> DOWN
   * CATCHES: a ghost that walks into its own house mid-chase and mills about
   *   inside it. The house's release rules then fight the chase, and a player
   *   watching sees ghosts vanish from the maze for no reason.
   * LOAD-BEARING: yes.
   *
   * WOULD A WRONG IMPLEMENTATION PASS? Not one that grants the door: the two
   * legal exits are a deliberate exact TIE, so the only way to score DOWN is to
   * have counted the gate as an exit. The tie also means the answer is decided
   * by section 9's documented tie order rather than by the distance metric, so
   * this test says nothing about metrics and cannot accidentally pass one.
   */
  it('never takes the house gate while hunting, even when Pac-Man is straight through it', () => {
    const state = buildState({
      modes: { waveIndex: 1 },
      pacman: { actor: { position: centreOf({ col: 13, row: 17 }) } },
      ghosts: {
        [GhostId.Blinky]: {
          phase: GhostPhase.Hunting,
          actor: {
            position: centreOf({ col: 13, row: 11 }),
            facing: Direction.Down,
            carrySubPixels: 16,
          },
        },
      },
    });

    const { state: next } = ghostSystem.run(state, frameContext(), []);

    expect(next.ghosts[GhostId.Blinky].actor.facing).toBe(Direction.Left);
    /* One pixel left of the centre of (13,11), which is (108,92). */
    expect(next.ghosts[GhostId.Blinky].actor.position).toEqual({ x: 107, y: 92 });
  });

  /**
   * TYPE: integration.
   * WHY THIS TYPE: `ghostSpeed` is a pure selection over a `TileKind`, and it is
   *   already unit-tested. What is NOT tested anywhere else is that this system
   *   asks it about the tile the ghost is actually standing on. Only a fixture
   *   with a ghost in the tunnel and a ghost outside it can show that.
   * MEASURES: the sub-pixels each ghost banks in one frame.
   * ORACLE: docs/ARCADE-REFERENCE.md section 11, "Ghost speed selection", whose
   *   table prints the level-1 sub-pixel figures outright: 240 for an ordinary
   *   ghost (75%) and 128 in the tunnel (40%). Neither reaches 256, so neither
   *   ghost moves a whole pixel this frame — the banked remainder IS the speed,
   *   observed with nothing else in the way.
   * CATCHES: the tunnel row read as ordinary floor. A frightened ghost cornered
   *   at a tunnel mouth is then nearly twice the speed the arcade gives it, and
   *   the safest place on the board stops being safe.
   * LOAD-BEARING: yes — the stub banks nothing at all.
   *
   * WOULD A WRONG IMPLEMENTATION PASS? Both ghosts are hunting, both start on a
   * centre pixel with an empty carry, and the ONLY difference between them is
   * which tile they stand on. Handing `ghostSpeed` a constant `TileKind.Open` —
   * the shape this defect actually takes — gives 240 for both and fails on the
   * tunnel ghost; using Pac-Man's 80% (256) fails on both.
   */
  it('banks the tunnel step in the tunnel and the full step outside it', () => {
    const state = buildState({
      ghosts: {
        /* (3,14) is on the tunnel row: `classic-layout.ts` row 14 opens with
           six T glyphs. (6,8) is ordinary floor. */
        [GhostId.Blinky]: {
          phase: GhostPhase.Hunting,
          actor: { position: centreOf({ col: 3, row: 14 }), carrySubPixels: 0 },
        },
        [GhostId.Pinky]: {
          phase: GhostPhase.Hunting,
          actor: { position: centreOf({ col: 6, row: 8 }), carrySubPixels: 0 },
        },
      },
    });

    const { state: next } = ghostSystem.run(state, frameContext(), []);

    expect(next.ghosts[GhostId.Blinky].actor.carrySubPixels).toBe(128);
    expect(next.ghosts[GhostId.Pinky].actor.carrySubPixels).toBe(240);
  });

  /**
   * TYPE: integration.
   * WHY THIS TYPE: a precedence between two rows of one table, which is only
   *   observable when both apply at once — a pair of eyes standing in the
   *   tunnel. The situation cannot be built without a board and a mover.
   * MEASURES: that eyes in the tunnel travel at the eyes speed.
   * ORACLE: docs/ARCADE-REFERENCE.md section 11.1, "The precedence, which is
   *   where the bugs are" — eyes beat everything, INCLUDING the tunnel. Section
   *   11.2 fixes the eyes speed at 150%, which is 480 sub-pixels at every level:
   *   one whole pixel of travel with 224 banked. The tunnel's 128 would move the
   *   ghost nowhere at all.
   * CATCHES: the table read in any other order, which leaves a pair of eyes
   *   crawling home at 40% and removes that ghost from play for an entire fright
   *   period — invisible in every unit test, and worth thousands of points a
   *   level to the player.
   * LOAD-BEARING: yes.
   */
  it('brings eyes through the tunnel at eye speed, not at the tunnel crawl', () => {
    const state = buildState({
      ghosts: {
        [GhostId.Blinky]: {
          phase: GhostPhase.Eyes,
          actor: {
            position: centreOf({ col: 3, row: 14 }),
            facing: Direction.Left,
            carrySubPixels: 0,
          },
        },
      },
    });

    const { state: next } = ghostSystem.run(state, frameContext(), []);

    /* The centre of (3,14) is (28,116); left is the tunnel row's only exit that
       is not the reversal. */
    expect(next.ghosts[GhostId.Blinky].actor.position).toEqual({ x: 27, y: 116 });
    expect(next.ghosts[GhostId.Blinky].actor.carrySubPixels).toBe(224);
  });

  /**
   * TYPE: integration.
   * WHY THIS TYPE: the rule is a PRECEDENCE between a phase and a timer, and the
   *   two live on different fields of the same ghost. Nothing below the system
   *   holds both.
   * MEASURES: that a ghost eaten during a fright period — eyes, with the fright
   *   timer still running — steers for the house door and takes no random draw.
   * ORACLE: `src/core/ghost/ghost.ts` states it outright: fright is a timer that
   *   runs ALONGSIDE the phase, and "an eaten ghost's eyes still remember they
   *   were heading home". docs/ARCADE-REFERENCE.md section 6.6 keeps the timer
   *   running for every ghost including this one, and section 11.1 orders eyes
   *   ahead of fright for the same reason. From (12,11) facing down the exits are
   *   left (11,11) and right (13,11) — up is the reversal, down is a wall — and
   *   the door tile is (13,12): left 2²+1²=5, right 0²+1²=1 -> RIGHT.
   * CATCHES: a system that asks "is it frightened?" before "is it eyes?". The
   *   eyes then wander at random, never reach the house, and the level continues
   *   one ghost short with nothing to point at the cause.
   * LOAD-BEARING: yes.
   *
   * WOULD A WRONG IMPLEMENTATION PASS? The context carries an EMPTY scripted
   * Rng, and `createScriptedRng` throws the moment it is asked for a value. A
   * system that routed these eyes through the frightened draw cannot answer at
   * all, let alone answer right — which turns "takes no draw" into an assertion
   * rather than a hope.
   */
  it('keeps eyes heading home even while the fright timer is still running', () => {
    const state = buildState({
      ghosts: {
        [GhostId.Blinky]: {
          phase: GhostPhase.Eyes,
          frightenedFramesLeft: 300,
          actor: {
            position: centreOf({ col: 12, row: 11 }),
            facing: Direction.Down,
            carrySubPixels: 0,
          },
        },
      },
    });

    const { state: next } = ghostSystem.run(
      state,
      frameContext({ rng: createScriptedRng([]) }),
      [],
    );

    expect(next.ghosts[GhostId.Blinky].actor.facing).toBe(Direction.Right);
    /* One pixel right of the centre of (12,11), which is (100,92). */
    expect(next.ghosts[GhostId.Blinky].actor.position).toEqual({ x: 101, y: 92 });
  });

  /**
   * TYPE: integration, over many frames.
   * WHY THIS TYPE: the arrival is an EDGE — a thing that happens on one frame of
   *   a journey and must not happen on the others. A single-frame test can assert
   *   the transition or its absence, never that there is exactly one of them, and
   *   "exactly one" is the whole property.
   * MEASURES: that eyes walk to the gate under their own targeting, become a
   *   ghost waiting in the house on arrival, and announce it once.
   * ORACLE: docs/ARCADE-REFERENCE.md section 6, "the house door comes from the
   *   maze" — `targetFor` sends eyes to `maze.houseDoorTile`, which for the
   *   authored board is the first `-` of row 12, tile (13,12). Section 12 then
   *   has the ghost wait in the house until the release rules let it out, so the
   *   phase after arrival is InHouse. The journey is 28 pixels — sixteen down
   *   column 12, eight right along row 11, four more down into the gate — and at
   *   480 sub-pixels a frame (section 11.2) that is fifteen frames, so twenty
   *   frames is comfortably past the arrival and includes five frames on which a
   *   second announcement would show up.
   * CATCHES: eyes that arrive and never transition, so the ghost hovers on the
   *   doorstep forever and the level quietly continues with three ghosts; and its
   *   mirror image, a `ghostReturnedHome` re-emitted every frame after arrival,
   *   which would retrigger the return jingle sixty times a second.
   * LOAD-BEARING: yes.
   *
   * WOULD A WRONG IMPLEMENTATION PASS? The eyes start six tiles and one corner
   * away from the gate, so arriving requires the target, the turn, the speed and
   * the mover all to be wired: a system that simply set the phase on a ghost that
   * happens to be standing on the door would never get there. The event list is
   * asserted whole rather than searched, so an extra emission fails.
   */
  it('walks eyes home to the gate and reports the return exactly once', () => {
    const state = buildState({
      ghosts: {
        [GhostId.Blinky]: {
          phase: GhostPhase.Eyes,
          actor: {
            position: centreOf({ col: 12, row: 9 }),
            facing: Direction.Down,
            carrySubPixels: 0,
          },
        },
      },
    });

    const { state: next, events } = runFrames(state, frameContext(), 20);

    expect(next.ghosts[GhostId.Blinky].phase).toBe(GhostPhase.InHouse);
    /* Twenty-eight pixels of travel land the eyes on (108,96) — the first pixel
       row of tile (13,12), since a tile is eight pixels tall. Arrival is the
       ghost ENTERING the gate tile, not reaching its centre. */
    expect(next.ghosts[GhostId.Blinky].actor.position).toEqual({ x: 108, y: 96 });
    expect(events).toEqual([{ kind: 'ghostReturnedHome', ghost: GhostId.Blinky }]);
  });

  /**
   * TYPE: integration.
   * WHY THIS TYPE: it is a boundary between two systems, and a boundary is only
   *   visible from a state that contains both sides of it.
   * MEASURES: that a ghost waiting in the house is not touched, while a ghost on
   *   the board takes its frame as usual.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12, "The ghost house" — a ghost
   *   inside the house leaves it when the RELEASE RULES say so, and those belong
   *   to the house system. A ghost that let itself out would make every counter
   *   in section 12.1 decorative.
   * CATCHES: a loop over all four ghosts with no phase check at all. Pinky then
   *   navigates out through the gate on the first frame of every level, the dot
   *   counters never fire, and the opening of a level — the part the arcade
   *   paces most carefully — collapses into all four ghosts on the board at once.
   * LOAD-BEARING: yes, on the Blinky half. The Pinky half is the guard, and it
   *   is deliberately armed: her carry is primed to the same 16 that moves Blinky
   *   a pixel, so "she did not move" is a decision this system made and not an
   *   accident of a step too small to see.
   */
  it('leaves a ghost waiting in the house alone, while the ghosts outside take their frame', () => {
    const state = buildState({
      ghosts: {
        [GhostId.Blinky]: {
          phase: GhostPhase.Hunting,
          actor: {
            position: centreOf({ col: 6, row: 8 }),
            facing: Direction.Left,
            carrySubPixels: 16,
          },
        },
        [GhostId.Pinky]: { phase: GhostPhase.InHouse, actor: { carrySubPixels: 16 } },
      },
    });

    const { state: next } = ghostSystem.run(state, frameContext(), []);

    /* The very same ghost record, not an equal copy: a system that rebuilt her
       would be banking sub-pixels on a ghost that is standing still. */
    expect(next.ghosts[GhostId.Pinky]).toBe(state.ghosts[GhostId.Pinky]);
    /* One pixel UP from the centre of (6,8), which is (52,68). Up rather than
       onward, and the reason is worth following because the first draft of this
       test guessed "onward" and was wrong: the fixture leaves the wave clock at
       its opening index, which is scatter (mode-schedule.ts, level 1), so Blinky
       steers for his corner (25,0) — docs/ARCADE-REFERENCE.md section 6.1. From
       (6,8) facing left the candidates score up (6,7) 19²+7²=410, left (5,8)
       20²+8²=464 and down (6,9) 19²+9²=442, so up wins. */
    expect(next.ghosts[GhostId.Blinky].actor.position).toEqual({ x: 52, y: 67 });
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: one guard over one field. Building a whole frame to observe a
   *   system declining to run would say nothing extra.
   * MEASURES: that nothing is simulated outside the playing phase, and that the
   *   state comes back as the SAME object.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7, "The round" — the READY! pause,
   *   the death animation and the maze flash are phases in which time passes and
   *   the world does not move. `src/core/game/system.ts` supplies the other half:
   *   a system that changes nothing returns the state it was given, by identity,
   *   because `runSystems` threads state by reference and never copies.
   * CATCHES: ghosts that keep hunting through the death animation, so a player
   *   who is caught once is caught twice — the difference between a fair game and
   *   an unfair one.
   * LOAD-BEARING: no — the do-nothing stub also returns the state untouched.
   *   A guard, and the only test that would catch "simulate unconditionally":
   *   Blinky's carry is primed so that a system which ran here WOULD move him.
   */
  it('simulates nothing while the round is not playing', () => {
    const state = buildState({
      phase: RoundPhase.Ready,
      phaseFramesLeft: 120,
      ghosts: {
        [GhostId.Blinky]: {
          phase: GhostPhase.Hunting,
          actor: {
            position: centreOf({ col: 6, row: 8 }),
            facing: Direction.Left,
            carrySubPixels: 16,
          },
        },
      },
    });

    const { state: next, events } = ghostSystem.run(state, frameContext(), []);

    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * MEASURES: that a frame in which no ghost is on the board returns the very
   *   state object it was handed.
   * ORACLE: `src/core/game/system.ts`, `unchanged` — "a system that changes
   *   nothing costs nothing. The state object is threaded through by reference,
   *   never defensively copied". The situation is ordinary rather than exotic:
   *   docs/ARCADE-REFERENCE.md section 12 puts a ghost back in the house after it
   *   is eaten, so a player who clears the quartet mid-fright has all four
   *   waiting at once.
   * CATCHES: a spread that rebuilds the state every frame regardless. Nothing
   *   VISIBLE breaks, which is exactly why it needs a test: every `toBe` identity
   *   assertion downstream quietly stops meaning anything.
   * LOAD-BEARING: no — the stub returns the same object too. Guard.
   */
  it('returns the very same state on a frame when every ghost is in the house', () => {
    const waiting = { phase: GhostPhase.InHouse, actor: { carrySubPixels: 200 } };
    const state = buildState({
      ghosts: {
        [GhostId.Blinky]: waiting,
        [GhostId.Pinky]: waiting,
        [GhostId.Inky]: waiting,
        [GhostId.Clyde]: waiting,
      },
    });

    const { state: next, events } = ghostSystem.run(state, frameContext(), []);

    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: integration, on a hand-drawn board.
   * WHY THIS TYPE: the case needs a tile whose ONLY exit is the reversal, and the
   *   arcade board has none that a five-line fixture could point at. `tinyMaze`'s
   *   dead end exists for exactly this, and the five rows are checkable by eye.
   * MEASURES: that a frightened ghost with nowhere else to go turns round,
   *   drawing once from the exits that are left.
   * ORACLE: docs/ARCADE-REFERENCE.md section 9.1, "The dead end" — the
   *   no-reversal rule is a PREFERENCE applied to the candidate list, and when
   *   removing the reversal would leave no candidate at all the reversal is
   *   taken. Section 10 supplies the other half: the draw is an index into the
   *   legal exits, so the list handed to it must never be empty. At (5,3) of the
   *   dead-end board the only walkable neighbour is (4,3), to the left, and the
   *   ghost arrives facing right — so the single candidate IS the reversal, and
   *   `nextInt(1)` is the one draw the script provides.
   * CATCHES: `rng.nextInt(0)`, which throws. Not a wrong turn — a crash, mid
   *   frame, in front of a player, on a board pocket the arcade walks into
   *   routinely.
   * LOAD-BEARING: yes.
   *
   * WOULD A WRONG IMPLEMENTATION PASS? The ghost faces RIGHT into the wall it
   * cannot pass, so "left" is a turn it can only reach by reconsidering the
   * reversal it had already dropped. A fixture with the ghost already facing left
   * would have made the dropped candidate irrelevant and this test vacuous.
   */
  it('turns a frightened ghost round in a dead end rather than drawing from nothing', () => {
    const state = buildState({
      ghosts: {
        [GhostId.Blinky]: {
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 300,
          actor: {
            position: centreOf({ col: 5, row: 3 }),
            facing: Direction.Right,
            carrySubPixels: 96,
          },
        },
      },
    });
    const ctx = frameContext({ maze: deadEndMaze(), rng: createScriptedRng([0]) });

    const { state: next } = ghostSystem.run(state, ctx, []);

    expect(next.ghosts[GhostId.Blinky].actor.facing).toBe(Direction.Left);
    /* One pixel left of the centre of (5,3), which is (44,28). */
    expect(next.ghosts[GhostId.Blinky].actor.position).toEqual({ x: 43, y: 28 });
  });
});
