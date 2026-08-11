import { describe, expect, it } from 'vitest';

import { Direction } from '../../geometry/direction.ts';
import { centreOf } from '../../geometry/tile.ts';
import { buildState } from '../../testing/state-builder.ts';
import { RoundPhase } from '../game-phase.ts';

import { inputSystem } from './input-system.ts';
import { frameContext, inputHolding } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The input system is the frame's first step, and it does exactly one thing:
 * it writes down what the player ASKED FOR. It never asks whether the maze
 * allows it — `pacmanTurnPolicy` is asked that question later in the same
 * frame, once per pixel, by pacman-system.
 *
 * That separation is the whole of "the turn I pressed early was remembered".
 * docs/ARCADE-REFERENCE.md section 8.4, "The queued turn, and how far it is
 * from the arcade", states the repo convention this system's half of the deal
 * rests on: a queued direction "is retried **every pixel** and applied at the
 * first tile centre where it is legal, and it **persists indefinitely** until
 * it is taken or overwritten — it never expires." A request that is recorded
 * only when it is already legal cannot persist, because there would be nothing
 * to persist: it would be applied or lost on the frame it was made. So the two
 * jobs are in two systems, and this file pins the one that remembers.
 *
 * Two things a reader should watch for in the fixtures below, because they are
 * the difference between a test and a decoration:
 *
 *   - Where a direction is asserted, the fixture carries FOUR DIFFERENT
 *     directions — one held, one faced, one queued on the actor, one already
 *     pending. An implementation that copies the wrong field then produces a
 *     wrong answer instead of accidentally the right one.
 *   - Where "it does not judge legality" is asserted, Pac-Man really is stood
 *     in a corner with a wall in the direction he is asking for. A fixture in
 *     open corridor would pass against an implementation that silently drops
 *     impossible requests.
 */
describe('inputSystem', () => {
  /**
   * TYPE: unit.
   * WHY THIS TYPE: recording a field is one assignment. Driving it through a
   *   whole frame would make a wrong answer here look like a movement bug three
   *   systems later, which is precisely the detective work a unit test buys you
   *   out of.
   * MEASURES: that the direction held THIS frame lands on
   *   `pacman.pendingDirection`.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4, "The queued turn, and how far
   *   it is from the arcade" — the original "reads the joystick every frame into
   *   a 'desired direction' and applies it the moment the maze allows". The
   *   field that desire is written to is fixed by the design split documented on
   *   `Pacman.pendingDirection`: "slice s10's input-system writes the player's
   *   last held direction here, and pacman-system mirrors it into `actor.queued`
   *   before moving."
   * CATCHES: the controls doing nothing at all — the player presses up, Pac-Man
   *   carries straight on through the junction, and no amount of pressing
   *   changes it.
   * LOAD-BEARING: yes — the stub returns the state untouched, so the pending
   *   turn is still `down`.
   */
  it('records the direction held this frame as the pending turn', () => {
    /* Four distinct directions on purpose. `up` is the only one the player is
       asking for now; `left`, `right` and `down` are the three plausible wrong
       answers an implementation could reach for. */
    const state = buildState({
      pacman: {
        actor: { facing: Direction.Left, queued: Direction.Right },
        pendingDirection: Direction.Down,
      },
    });

    const { state: next } = inputSystem.run(
      state,
      frameContext({ input: inputHolding(Direction.Up) }),
      [],
    );

    expect(next.pacman.pendingDirection).toBe(Direction.Up);
  });

  /**
   * TYPE: unit.
   * MEASURES: that the actor itself is untouched — same object, so neither
   *   `queued` nor `facing` nor the position moved.
   * ORACLE: the design split quoted above and on `pacman-turn.ts`: a
   *   `TurnPolicy` receives a `TurnContext`, which carries the `Actor` and not
   *   the `Pacman`, so `actor.queued` is the only queue the turn RULE can see —
   *   and it is pacman-system, after the turn policy has had its say, that
   *   mirrors `pendingDirection` into it.
   * CATCHES: an input system that writes `actor.queued` directly, skipping the
   *   mirror step. The turn would then be taken with no policy consulted at the
   *   moment it was requested, and — because the policy is also what refuses a
   *   direction the wall blocks — the symptom is Pac-Man turning into walls on
   *   the frame the key goes down.
   * LOAD-BEARING: no — the stub touches nothing either. A guard, and the only
   *   test that separates "wrote the pending turn" from "wrote the queue".
   */
  it('leaves the actor alone, because mirroring the turn is pacman-system’s job', () => {
    const state = buildState({
      pacman: {
        actor: { facing: Direction.Left, queued: Direction.Right },
        pendingDirection: Direction.Down,
      },
    });

    const { state: next } = inputSystem.run(
      state,
      frameContext({ input: inputHolding(Direction.Up) }),
      [],
    );

    expect(next.pacman.actor).toBe(state.pacman.actor);
    expect(next.pacman.actor.queued).toBe(Direction.Right);
  });

  /**
   * TYPE: unit.
   * MEASURES: that a frame with no key held leaves the pending turn standing —
   *   and, because nothing changed, returns the very state object it was given.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4, "The queued turn, and how far
   *   it is from the arcade": a queued direction "persists indefinitely until it
   *   is taken or overwritten — it never expires". Letting go of the joystick is
   *   neither taking it nor overwriting it. Section 8.4 also fixes what the
   *   absence of input means for movement — "letting go of the joystick does not
   *   stop Pac-Man", as `pacman-turn.ts` records — so null is not an instruction,
   *   it is the absence of one.
   * CATCHES: the bug this system exists to avoid. Every human turn has a frame
   *   or two between releasing right and pressing up; if null cleared the queue,
   *   that gap would erase the turn just requested and cornering would demand
   *   holding the new direction through the exact frame of the junction.
   * LOAD-BEARING: no — the stub leaves the state alone, which is the right
   *   answer here. A guard against a plausible wrong implementation, not against
   *   a missing one.
   */
  it('leaves a queued turn intact when no key is held', () => {
    const state = buildState({ pacman: { pendingDirection: Direction.Down } });

    /* frameContext defaults to NEUTRAL_INPUT: direction null. */
    const { state: next } = inputSystem.run(state, frameContext(), []);

    expect(next.pacman.pendingDirection).toBe(Direction.Down);
    /* Identity, not equality. `runSystems` threads the state by reference and
       never copies, so "nothing happened" must be the same object. */
    expect(next).toBe(state);
  });

  /**
   * TYPE: unit.
   * MEASURES: that the newest request wins over one already pending.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4, "The queued turn, and how far
   *   it is from the arcade" — a queued direction persists "until it is taken or
   *   OVERWRITTEN". Overwriting is what this test is.
   * CATCHES: a "first request wins" implementation, which only writes when the
   *   pending turn is empty. It looks perfect in a straight corridor and then
   *   locks the controls the moment a turn cannot be taken: the un-takeable
   *   request sits there forever and every later key press is ignored.
   * LOAD-BEARING: yes.
   */
  it('overwrites a turn the player queued earlier with the one held now', () => {
    const state = buildState({
      pacman: { actor: { facing: Direction.Up }, pendingDirection: Direction.Left },
    });

    const { state: next } = inputSystem.run(
      state,
      frameContext({ input: inputHolding(Direction.Right) }),
      [],
    );

    expect(next.pacman.pendingDirection).toBe(Direction.Right);
  });

  /**
   * TYPE: unit.
   * MEASURES: that a direction the maze forbids is recorded anyway.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4, "The queued turn, and how far
   *   it is from the arcade" — the queued direction "is retried every pixel and
   *   applied at the first tile centre where it is legal". A request that is
   *   never written down cannot be retried at all, so recording has to come
   *   first and legality second. The walls are the authored board in
   *   `classic-layout.ts`: row 0 is `############################`, so the tile
   *   above (col 1, row 1) — the top-left corner of the outer corridor — is
   *   solid wall.
   * CATCHES: an input system that "helpfully" filters impossible directions.
   *   The player would then have to press up at the exact pixel the junction
   *   allows it, and every turn pressed a corridor early — which is how the game
   *   is actually played — would be thrown away. This is the single behaviour
   *   that makes cornering forgiving.
   * LOAD-BEARING: yes.
   */
  it('records a direction the wall forbids, because legality is not its decision', () => {
    const state = buildState({
      pacman: {
        /* Standing in the top-left corner of the outer corridor, facing right,
           asking for up — into the outer wall. */
        actor: { position: centreOf({ col: 1, row: 1 }), facing: Direction.Right },
        pendingDirection: null,
      },
    });

    const { state: next } = inputSystem.run(
      state,
      frameContext({ input: inputHolding(Direction.Up) }),
      [],
    );

    expect(next.pacman.pendingDirection).toBe(Direction.Up);
  });

  /**
   * TYPE: unit.
   * MEASURES: two absences at once — that the system has no phase branch, and
   *   that it has no "the player is already facing that way" branch.
   * ORACLE: a stated design invariant. This system's whole contract is "sample
   *   the input and record it"; nothing in docs/ARCADE-REFERENCE.md section 7,
   *   "The round: how a game begins, and the pauses between play", makes the
   *   READY! pause deaf to the controls, and section 8.4's queue "persists
   *   indefinitely", so a request made during the countdown is still standing
   *   when play begins.
   * CATCHES: the request being dropped when it is made during READY! and
   *   released before play starts — the player nudges left during the countdown
   *   and Pac-Man sets off right. It equally catches an implementation that
   *   skips a direction matching `facing`, which would break the arcade's own
   *   model: the joystick is a LEVEL, read every frame, and "already facing
   *   left" is not a reason to forget that left is being asked for.
   * LOAD-BEARING: yes — under the stub the pending turn is still null.
   */
  it('records during the READY! countdown, even facing that way already', () => {
    const state = buildState({
      phase: RoundPhase.Ready,
      phaseFramesLeft: 120,
      pacman: { actor: { facing: Direction.Left }, pendingDirection: null },
    });

    const { state: next } = inputSystem.run(
      state,
      frameContext({ input: inputHolding(Direction.Left) }),
      [],
    );

    expect(next.pacman.pendingDirection).toBe(Direction.Left);
  });

  /**
   * TYPE: unit.
   * MEASURES: that recording a turn is ALL it does — no events, and every other
   *   part of the world still the same object it was.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4 gives this system one job, and
   *   the `GameEvent` union is defined as "everything the core can say about
   *   what just happened": pressing a key is not something that happened to the
   *   game, it is something the player asked for, and it may yet come to
   *   nothing.
   * CATCHES: an input system that announces a turn. Every consumer of the event
   *   list is an audio decision, so a `phaseChanged`-style announcement here
   *   would fire a sound sixty times a second while a key is held. The identity
   *   checks catch the other half: a system that rebuilds the ghosts or the
   *   pellet field on the way past makes every `toBe` downstream fail for
   *   reasons no test in that file can explain.
   * LOAD-BEARING: no — the stub emits nothing and copies nothing. A guard.
   */
  it('emits nothing and leaves the rest of the world untouched', () => {
    const state = buildState({ pacman: { pendingDirection: null } });

    const { state: next, events } = inputSystem.run(
      state,
      frameContext({ input: inputHolding(Direction.Up) }),
      [],
    );

    expect(events).toEqual([]);
    expect(next.ghosts).toBe(state.ghosts);
    expect(next.pellets).toBe(state.pellets);
    expect(next.score).toBe(state.score);
  });

  /**
   * TYPE: unit.
   * MEASURES: that holding a direction already recorded costs nothing — the
   *   state object comes back unchanged, not rebuilt.
   * ORACLE: a stated design invariant, from `system.ts` on `runSystems`: "A
   *   system that changes nothing costs nothing. The state object is threaded
   *   through by reference, never defensively copied, so the result of a frame
   *   in which nothing moved is the very object that went in." A held key is the
   *   normal case, not an edge case — `GameInput.direction` "is a LEVEL. It says
   *   what is held down right now" — so this is what the system does on almost
   *   every frame of a real game.
   * CATCHES: an implementation that rebuilds the state on every frame a key is
   *   held. Nothing observable changes, which is exactly why it is dangerous: it
   *   silently defeats every `toBe` identity check downstream and turns "did
   *   this frame change anything?" — the cheapest question the pipeline can ask
   *   — into a permanent yes.
   * LOAD-BEARING: no — the stub returns the same object. A guard.
   */
  it('returns the same state when the held direction is already the pending one', () => {
    const state = buildState({
      pacman: { actor: { facing: Direction.Up }, pendingDirection: Direction.Right },
    });

    const { state: next } = inputSystem.run(
      state,
      frameContext({ input: inputHolding(Direction.Right) }),
      [],
    );

    expect(next).toBe(state);
  });
});
