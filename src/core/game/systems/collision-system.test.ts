import { describe, expect, it } from 'vitest';

import { type Tile, centreOf } from '../../geometry/tile.ts';
import { GhostId } from '../../ghost/ghost-id.ts';
import { GhostPhase } from '../../ghost/ghost.ts';
import { buildState } from '../../testing/state-builder.ts';
import { PHASE_FRAMES, RoundPhase } from '../game-phase.ts';
import { SystemId } from '../system.ts';

import { createCollisionSystem } from './collision-system.ts';
import { frameContext } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * This system decides whether the player is having a good frame or the worst
 * one. Everything else in the pipeline moves things around; this is the one
 * that turns a shared tile into 1600 points or into a lost life.
 *
 * THE FACTORY IS THE POINT OF THE FILE. `createCollisionSystem` returns a
 * System rather than being one, because the pipeline installs TWO of them —
 * `collision-early` after Pac-Man moves and `collision-late` after the ghosts
 * move (`system.ts`, `SystemId`). That pair is what reproduces the arcade's
 * pass-through (docs/ARCADE-REFERENCE.md section 13.5): two actors that
 * EXCHANGE adjacent tiles never share one on any frame, so nothing happens to
 * either. Running the same rule twice a frame is therefore not a belt-and-
 * braces measure, it is the rule — which is why "twice in one frame is correct,
 * not merely tolerated" gets two tests of its own below.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not decide the outcome:
 * `rules/collision.ts` owns "same tile, and is the ghost blue?" and is already
 * green against the arcade table. It does not own the ladder either:
 * `rules/ghost-combo.ts` owns 200/400/800/1600 and the meaning of the chain
 * index. It does not spend the life, reset the actors or end the game — it
 * emits `pacmanCaught` and life-system, running last in the same frame, hears
 * it. This file tests the WIRING between those, and nothing that they already
 * pin themselves.
 *
 * WHERE THE CHAIN COMES FROM, AND WHY THAT IS TESTABLE AT ALL. `GameState`
 * carries no "ghosts eaten this fright" counter — `game-state.ts` lists every
 * field, and `eat-system.ts` records the same absence. What it does carry is
 * each ghost's phase, and a ghost is in `Eyes` or `EnteringHouse` for exactly
 * one reason: it was eaten and has not got home yet. So the ghosts already
 * heading home ARE the chain, and the tests below are written against that
 * observable rather than against a field that does not exist.
 */
describe('createCollisionSystem', () => {
  /**
   * The tile Pac-Man and a ghost share, chosen ASYMMETRICALLY.
   *
   * Column 21, row 11 — its transpose (column 11, row 11) is inside the wall
   * block on that row, so a fixture or an implementation that swaps col and row
   * puts the ghost in a wall rather than quietly landing on another legal tile
   * and passing anyway. Read off `maze/classic-layout.ts`: row 11 is
   * `######.##    1     ##.######`.
   */
  const MEETING: Tile = { col: 21, row: 11 };

  /** Directly above `MEETING`: same column, one row off. */
  const ONE_ROW_AWAY: Tile = { col: 21, row: 10 };

  /** The far side of row 11: same row, fifteen columns off. */
  const SAME_ROW_AWAY: Tile = { col: 6, row: 11 };

  /**
   * A score that is not zero and not a multiple of any rung of the ladder.
   *
   * With a zero start, "score = points" and "score = score + points" are the
   * same number and the wrong one passes; with 1230 they differ by 1230 in
   * every assertion below.
   */
  const SCORE_BEFORE = 1230;

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the claim is one field on the value the factory returns.
   *   Nothing cheaper exists, and reaching it through the pipeline would be
   *   asserting slice s12's array rather than this factory.
   * MEASURES: that the id passed in is the id that comes out — for BOTH ids,
   *   not just the one that happens to be first.
   * ORACLE: `system.ts`, `SystemId` — `CollisionEarly` is 'collision-early' and
   *   `CollisionLate` is 'collision-late', and the same comment states why
   *   collision appears twice.
   * CATCHES: a factory that ignores its argument and hard-codes one id. The
   *   pipeline then holds two systems called 'collision-early', the ordering
   *   test in slice s12 fails with a diff about names rather than about
   *   behaviour, and — worse — anything that later routes by id (a profiler, a
   *   debug overlay, an event trace) attributes the ghosts' collisions to
   *   Pac-Man's half of the frame.
   * LOAD-BEARING: no — the stub already returns the id it was handed. A guard,
   *   and a deliberate one: it is the only test that would notice the argument
   *   being dropped.
   */
  it('honours the id it is given, because the pipeline installs it twice', () => {
    expect(createCollisionSystem(SystemId.CollisionEarly).id).toBe('collision-early');
    expect(createCollisionSystem(SystemId.CollisionLate).id).toBe('collision-late');
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the rule is proven in `rules/collision.ts`; what is unproven
   *   is that this system reads Pac-Man's tile, asks the ladder for the value,
   *   writes the score and turns the ghost into eyes. A hand-built state shows
   *   all four in four assertions. Through the pipeline, Pac-Man and a ghost
   *   would first have to walk onto the same tile, which is a test of movement.
   * MEASURES: the first ghost of a fright scores 200, the score is ADDED to,
   *   the ghost is sent home as eyes, and the event carries both the value and
   *   the chain index.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.2, "The ghost ladder: 200, 400,
   *   800, 1600" — quoted from the Dossier, "The first ghost captured after an
   *   energizer has been eaten is always worth 200 points." Chain index 1 is
   *   `chainAfterGhostEaten(0)` in `rules/ghost-combo.ts`: the ladder counts
   *   ghosts eaten, so the first one eaten makes it 1.
   * CATCHES: a ghost that is eaten but keeps hunting — the player runs over a
   *   blue ghost, hears the sound, gets the points and is then killed by the
   *   very same ghost on the next frame, because nothing ever moved it out of
   *   the way.
   * LOAD-BEARING: yes — the stub scores nothing and emits nothing.
   *
   * IMPOSTER THIS FIXTURE IS BUILT TO FAIL: Clyde is the ghost eaten, not
   * Blinky. An implementation that resolves `GHOST_ORDER[0]`, or the first key
   * of the record, finds Blinky sitting on his own spawn tile and reports
   * nothing at all. The other three ghosts are left in the house, so an
   * implementation that counts "ghosts not hunting" instead of "ghosts heading
   * home" sees two and pays 800.
   */
  it('eats a frightened ghost for 200, sends it home as eyes, and says so', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(MEETING) } },
      score: SCORE_BEFORE,
      ghosts: {
        [GhostId.Clyde]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 300,
        },
      },
    });

    const { state: next, events } = createCollisionSystem(SystemId.CollisionEarly).run(
      state,
      frameContext(),
      [],
    );

    expect(next.score).toBe(1430);
    expect(next.ghosts[GhostId.Clyde].phase).toBe(GhostPhase.Eyes);
    expect(next.phase).toBe(RoundPhase.Playing);
    expect(events).toEqual([{ kind: 'ghostEaten', ghost: GhostId.Clyde, points: 200, chain: 1 }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the discriminating fixture is a world with two ghosts
   *   already on their way home, which is one `buildState` patch here and about
   *   four hundred frames of play through the pipeline.
   * MEASURES: that the value of a ghost depends on how many have been eaten
   *   during this fright, and that BOTH ways of being on the way home count.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.2 — with two ghosts eaten so
   *   far the next is worth 800, and it is the third of the chain. The table
   *   reads: 0 eaten -> 200, 1 -> 400, 2 -> 800, 3 -> 1600.
   * CATCHES: a ladder nailed to its first rung. Every ghost pays 200, a full
   *   chain totals 800 instead of 3000, and the entire reason to lure four
   *   ghosts onto one energizer disappears — the game still looks completely
   *   normal.
   * LOAD-BEARING: yes.
   *
   * IMPOSTER THIS FIXTURE IS BUILT TO FAIL: the two ghosts already eaten are in
   * DIFFERENT phases — Blinky is `Eyes` in the corridor, Pinky is
   * `EnteringHouse` at the door. An implementation that counts only `Eyes`
   * loses a rung the instant a ghost crosses the doorway, which is a scoring
   * bug that appears and disappears depending on where the eyes happen to be.
   * Clyde is left `InHouse`, so counting "every ghost that is not hunting"
   * pays 1600 instead.
   */
  it('climbs the ladder: with two ghosts already heading home the third is worth 800', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(MEETING) } },
      score: SCORE_BEFORE,
      ghosts: {
        [GhostId.Blinky]: { phase: GhostPhase.Eyes, frightenedFramesLeft: 300 },
        [GhostId.Pinky]: { phase: GhostPhase.EnteringHouse, frightenedFramesLeft: 300 },
        [GhostId.Inky]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 300,
        },
      },
    });

    const { state: next, events } = createCollisionSystem(SystemId.CollisionEarly).run(
      state,
      frameContext(),
      [],
    );

    expect(next.score).toBe(2030);
    expect(events).toEqual([{ kind: 'ghostEaten', ghost: GhostId.Inky, points: 800, chain: 3 }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: a crossing is a fact about a pair of scores, so the fixture
   *   has to name the score before. One state, one run, three assertions.
   * MEASURES: that ghost points go through the same crossing detector the
   *   pellets do, and that the life is announced as well as granted.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.3, "The extra life: one, at
   *   10000 points" — awarded on the addition that takes the score from below
   *   10000 to 10000 or above. The section's own worked example is a ghost
   *   chain: "no life at all when a 1600-point chain leaps from 9000 to 10600"
   *   is what the wrong reading costs.
   * CATCHES: the extra life silently lost forever. `addScore` reports the
   *   crossing exactly once (`rules/score.ts`), so a system that adds ghost
   *   points and throws the report away does not delay the life — it deletes
   *   it, because every later addition truthfully reports false. The player
   *   passes 10000 on a ghost chain, which is the normal way to pass 10000,
   *   and never gets the life.
   * LOAD-BEARING: yes.
   */
  it('awards the extra life on the ghost that carries the score past 10000', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(MEETING) } },
      score: 9900,
      lives: 3,
      extraLifeAwarded: false,
      ghosts: {
        [GhostId.Clyde]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 300,
        },
      },
    });

    const { state: next, events } = createCollisionSystem(SystemId.CollisionEarly).run(
      state,
      frameContext(),
      [],
    );

    expect(next.score).toBe(10100);
    expect(next.lives).toBe(4);
    expect(next.extraLifeAwarded).toBe(true);
    expect(events).toEqual([
      { kind: 'ghostEaten', ghost: GhostId.Clyde, points: 200, chain: 1 },
      { kind: 'extraLife', lives: 4 },
    ]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: two ghosts stacked on one tile is a legal world that is
   *   awkward to arrange by playing and trivial to state as a fixture.
   * MEASURES: that the ladder advances WITHIN one run, and that the ghosts are
   *   resolved in `GHOST_ORDER`.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.2, quoted from the Dossier:
   *   "Each additional ghost captured from the same energizer will then be
   *   worth twice as many points as the one before it — 400, 800, and 1,600
   *   points, respectively." So two ghosts are 200 then 400, totalling 600.
   *   The order is `GHOST_ORDER` in `ghost/ghost-id.ts`, which names collision
   *   order as one of its four jobs, and Pinky precedes Clyde in it.
   * CATCHES: a chain index computed once, before the loop, instead of carried
   *   through it. Both ghosts pay 200 and the event stream claims two "first
   *   ghosts" — the HUD draws 200 twice over the same tile and the player is
   *   quietly robbed of the doubling that the whole chain exists for.
   * LOAD-BEARING: yes.
   */
  it('takes two frightened ghosts on one tile in ghost order, at 200 then 400', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(MEETING) } },
      score: SCORE_BEFORE,
      ghosts: {
        [GhostId.Pinky]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 300,
        },
        [GhostId.Clyde]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 300,
        },
      },
    });

    const { state: next, events } = createCollisionSystem(SystemId.CollisionEarly).run(
      state,
      frameContext(),
      [],
    );

    expect(next.score).toBe(1830);
    expect(events).toEqual([
      { kind: 'ghostEaten', ghost: GhostId.Pinky, points: 200, chain: 1 },
      { kind: 'ghostEaten', ghost: GhostId.Clyde, points: 400, chain: 2 },
    ]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the death is a phase change plus one event, both readable
   *   off a single run. An integration test would prove the same thing while
   *   also depending on ghost speeds lining up.
   * MEASURES: that a hunting ghost on Pac-Man's tile starts the death freeze
   *   with its full duration, announces the culprit, and scores nothing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.5, "Collision: one tile, three
   *   outcomes" — quoted from the Dossier: "Any time Pac-Man occupies the same
   *   tile as a ghost, he is considered to have collided with that ghost and a
   *   life is lost." The freeze is section 7.2's table: `dying` lasts 180
   *   frames, "a ~1 s freeze on the moment of capture, then the ~2 s death
   *   spin" — `PHASE_FRAMES[Dying]` is that row.
   * CATCHES: two bugs that both hang the machine rather than crash it. A phase
   *   set to `dying` with no frames left never counts down at all
   *   (`phase-system.ts` treats zero as "no timer"), so the game freezes on the
   *   frame of death forever; and a life quietly spent here as well as in
   *   life-system would cost the player two lives per mistake.
   * LOAD-BEARING: yes.
   *
   * IMPOSTER THIS FIXTURE IS BUILT TO FAIL: the killer is Inky, the third ghost
   * in `GHOST_ORDER`, so an event that reports whichever ghost the loop started
   * with — or ended on — names the wrong one. `lives` is asserted UNCHANGED,
   * because spending it here is the plausible wrong thing to do.
   */
  it('starts the death freeze when a hunting ghost shares the tile, and scores nothing', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(MEETING) } },
      score: SCORE_BEFORE,
      lives: 3,
      ghosts: {
        [GhostId.Inky]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 0,
        },
      },
    });

    const { state: next, events } = createCollisionSystem(SystemId.CollisionLate).run(
      state,
      frameContext(),
      [],
    );

    expect(next.phase).toBe(RoundPhase.Dying);
    expect(next.phaseFramesLeft).toBe(PHASE_FRAMES[RoundPhase.Dying]);
    expect(next.phaseFramesLeft).toBe(180);
    expect(next.score).toBe(SCORE_BEFORE);
    expect(next.lives).toBe(3);
    expect(events).toEqual([{ kind: 'pacmanCaught', ghost: GhostId.Inky }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the exemption is a third branch of a rule the other tests
   *   drive, and it needs one state to state it.
   * MEASURES: that a ghost already on its way home is neither food nor danger,
   *   even standing exactly on Pac-Man.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.5 — "same tile, ghost is eyes
   *   heading home" resolves to nothing. Section 6.6's divergence is why the
   *   fright timer is left RUNNING in this fixture: fright is one global timer,
   *   so `isFrightened` is true of a pair of eyes and only the phase can say
   *   otherwise.
   * CATCHES: eyes treated as edible, which lets the player re-eat the same
   *   ghost for another 1600 points every frame all the way to the house door —
   *   an infinite score fountain — or eyes treated as a hunting ghost, which
   *   kills Pac-Man for the crime of standing where a ghost he already ate
   *   happens to be walking.
   * LOAD-BEARING: no — the stub also does nothing here. A guard, and one that
   *   only means anything sitting beside the two tests above: alone, it is
   *   passed by an implementation that never collides with anything.
   */
  it('lets a pair of eyes pass straight through, even with the fright timer running', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(MEETING) } },
      score: SCORE_BEFORE,
      ghosts: {
        [GhostId.Clyde]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Eyes,
          frightenedFramesLeft: 300,
        },
      },
    });

    const { state: next, events } = createCollisionSystem(SystemId.CollisionEarly).run(
      state,
      frameContext(),
      [],
    );

    /* The SAME object, not an equal one: a frame in which nothing happened must
       cost nothing, and `system.ts` says identity is asserted downstream. */
    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: it takes two ghosts placed by hand at two specific offsets.
   *   No cheaper form exists, and no dearer one would be clearer.
   * MEASURES: that a near miss is a miss — one tile up and fifteen tiles across
   *   are both "not the same tile".
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.5 — collision is tile
   *   occupancy, "not pixel distance". A neighbouring tile centre is 8 pixels
   *   away (`TILE_SIZE` in `geometry/tile.ts`), and 8 pixels is a miss.
   * CATCHES: two different wrong comparisons. A proximity radius makes the
   *   ghost above lethal, so Pac-Man dies a tile early and players report
   *   ghosts killing them "through the wall"; a comparison that tests only one
   *   coordinate makes the ghost fifteen columns away lethal, which is
   *   unplayable and yet passes any fixture whose actors differ in both.
   * LOAD-BEARING: no — the stub reports nothing for everybody. A guard, kept
   *   because it is the only place the near miss is written down.
   */
  it('ignores a ghost one row away and a ghost fifteen columns away', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(MEETING) } },
      score: SCORE_BEFORE,
      ghosts: {
        [GhostId.Pinky]: {
          actor: { position: centreOf(ONE_ROW_AWAY) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 0,
        },
        [GhostId.Inky]: {
          actor: { position: centreOf(SAME_ROW_AWAY) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 0,
        },
      },
    });

    const { state: next, events } = createCollisionSystem(SystemId.CollisionEarly).run(
      state,
      frameContext(),
      [],
    );

    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: integration.
   * WHY THIS TYPE: idempotence under the pipeline's double invocation is a
   *   property of this system's OUTPUT fed back into its input, so nothing
   *   smaller than two runs threaded together can see it. It is still one
   *   system and one hand-built state — no pipeline, no other system.
   * MEASURES: that a ghost already overlapping Pac-Man before the ghosts move
   *   is eaten once across both runs of the frame, paid once, and advances the
   *   ladder by one rung.
   * ORACLE: `system.ts`, `SystemId` — collision runs after Pac-Man moves and
   *   again after the ghosts move, so both runs see this overlap. The value is
   *   docs/ARCADE-REFERENCE.md section 13.2's first rung, 200, once.
   * CATCHES: double scoring on every frame where the overlap predates the
   *   ghosts' move: a 200-point ghost pays 600, the ladder skips a rung, the
   *   four-ghost chain totals something other than 3000, and the ghostEaten
   *   sound fires twice. Every single-run test in this file stays green.
   * LOAD-BEARING: yes — the stub emits nothing, so "exactly one" fails at zero.
   */
  it('eats the ghost once when both halves of the frame see the same overlap', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(MEETING) } },
      score: SCORE_BEFORE,
      ghosts: {
        [GhostId.Clyde]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 300,
        },
      },
    });

    const early = createCollisionSystem(SystemId.CollisionEarly).run(state, frameContext(), []);
    const late = createCollisionSystem(SystemId.CollisionLate).run(
      early.state,
      frameContext(),
      early.events,
    );

    expect([...early.events, ...late.events]).toEqual([
      { kind: 'ghostEaten', ghost: GhostId.Clyde, points: 200, chain: 1 },
    ]);
    expect(late.state.score).toBe(1430);
    /* The second run found nothing left to do, so it must not have built a new
       world to say so. */
    expect(late.state).toBe(early.state);
  });

  /**
   * TYPE: integration.
   * WHY THIS TYPE: same reason as the test above, for the other outcome. The
   *   two are separate tests because they fail for different reasons and a
   *   reader should be told which one broke.
   * MEASURES: that a death detected in the first half of the frame is not
   *   detected again in the second half.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.6, "Losing a life" — one
   *   capture costs one life. Section 7.2: `dying` is a phase in which the
   *   world does not simulate, so nothing else may happen during it.
   * CATCHES: two `pacmanCaught` events in one frame. life-system, which listens
   *   to `incoming`, spends a life for each: the player loses two lives for one
   *   mistake, and from a single life the game jumps to game over having drawn
   *   a -1 in the HUD on the way.
   * LOAD-BEARING: yes.
   */
  it('catches Pac-Man once when both halves of the frame see the same overlap', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(MEETING) } },
      lives: 3,
      ghosts: {
        [GhostId.Inky]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 0,
        },
      },
    });

    const early = createCollisionSystem(SystemId.CollisionEarly).run(state, frameContext(), []);
    const late = createCollisionSystem(SystemId.CollisionLate).run(
      early.state,
      frameContext(),
      early.events,
    );

    expect([...early.events, ...late.events]).toEqual([
      { kind: 'pacmanCaught', ghost: GhostId.Inky },
    ]);
    expect(late.state).toBe(early.state);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: one field of the state decides it, so one state states it.
   * MEASURES: that collisions are not resolved while the round is not playing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 7.2 — READY! is a pause in which
   *   the world does not simulate; `game-phase.ts` gives it 120 frames.
   * CATCHES: Pac-Man killed during the READY! countdown, before the player has
   *   touched the stick — and, in the LevelComplete phase, killed by a ghost
   *   standing on him while the maze flashes, which turns a cleared board into
   *   a lost life. The player's own input had no bearing on either.
   * LOAD-BEARING: no — the stub does nothing in every phase. A guard. The
   *   branch it describes is also reached by the double-run death test above,
   *   which is what stops it being merely decorative: this test names the rule,
   *   that one proves it matters.
   */
  it('resolves nothing during the READY! pause, when the world is not simulating', () => {
    const state = buildState({
      phase: RoundPhase.Ready,
      phaseFramesLeft: PHASE_FRAMES[RoundPhase.Ready],
      pacman: { actor: { position: centreOf(MEETING) } },
      ghosts: {
        [GhostId.Inky]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 0,
        },
      },
    });

    const { state: next, events } = createCollisionSystem(SystemId.CollisionEarly).run(
      state,
      frameContext(),
      [],
    );

    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the pass-through is a claim about two CONSECUTIVE frames,
   *   which is two runs of one system over two hand-placed worlds. Played out
   *   through the pipeline it would depend on Pac-Man's and the ghost's speeds
   *   lining up exactly, and would flake the first time a speed row changed.
   * MEASURES: that a ghost and Pac-Man who EXCHANGE adjacent tiles between two
   *   frames collide on neither of them.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.5, "The pass-through is
   *   faithful, not a bug" — the comparison is made once per frame on whole
   *   tiles, so two actors that swap tiles never share one.
   * CATCHES: somebody "fixing" this by adding path-crossing detection. Pac-Man
   *   then dies in situations the original let him live, and nothing else in
   *   the suite notices — the difference is invisible until someone who plays
   *   well notices they are being killed by ghosts they used to slip past.
   * LOAD-BEARING: no — a system that never collides passes it. Its value is
   *   entirely in the NAME: it tells the next reviewer that this is reproduced
   *   arcade behaviour and must not be repaired.
   */
  it('never collides when Pac-Man and a ghost swap tiles between two frames', () => {
    expect.assertions(2);
    const before = buildState({
      pacman: { actor: { position: centreOf(MEETING) } },
      ghosts: {
        [GhostId.Pinky]: {
          actor: { position: centreOf(ONE_ROW_AWAY) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 0,
        },
      },
    });
    const after = buildState({
      pacman: { actor: { position: centreOf(ONE_ROW_AWAY) } },
      ghosts: {
        [GhostId.Pinky]: {
          actor: { position: centreOf(MEETING) },
          phase: GhostPhase.Hunting,
          frightenedFramesLeft: 0,
        },
      },
    });

    for (const frame of [before, after]) {
      expect(
        createCollisionSystem(SystemId.CollisionLate).run(frame, frameContext(), []).events,
      ).toEqual([]);
    }
  });
});
