import { describe, expect, it } from 'vitest';

import { type Tile, centreOf } from '../../geometry/tile.ts';
import { GHOST_ORDER, GhostId } from '../../ghost/ghost-id.ts';
import { GhostPhase, isFrightened } from '../../ghost/ghost.ts';
import { PelletKind, pelletAt } from '../../maze/pellets.ts';
import { levelSpec } from '../../rules/level-table.ts';
import { buildState } from '../../testing/state-builder.ts';

import { eatSystem } from './eat-system.ts';
import { frameContext } from './system-fixture.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The eat system is where the board changes and where the player's score comes
 * from. It runs immediately after Pac-Man moves, and it answers one question:
 * what was under him when he arrived?
 *
 * Four consequences hang off that one question, and they are the reason this is
 * a system rather than a line in the movement code:
 *
 *   - the score goes up by 10 or by 50, and crossing 10000 buys a life;
 *   - Pac-Man freezes for 1 frame or 3, which is the ONLY reason a full board
 *     is dangerous — at level 1 he moves at 80% against the ghosts' 75%, so
 *     without the freeze nothing could ever catch him (section 8.2);
 *   - an energizer turns every ghost blue and turns every ghost around;
 *   - the two events it forwards are what the siren, the house counters and the
 *     level-clear check all listen to. They are the only channel out of here.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not decide WHERE Pac-Man is (that
 * is pacman-system, which ran a moment ago) and it does not apply the freeze it
 * reports (pacman-system again, next frame). It also does not advance the house
 * dot counters: house-system runs later in the same frame and reads the
 * `pelletEaten` event out of `incoming`, which is what "events are the only
 * channel between systems" means in practice.
 *
 * ONE PIECE OF ARCADE BEHAVIOUR IS NOT ASSERTED HERE, AND IT IS NOT AN
 * OVERSIGHT. Section 13.2 says the ghost-score ladder resets when the FRIGHT
 * PERIOD ENDS, so an energizer taken while the ghosts are already blue extends
 * the fright and leaves the ladder climbing. `rules/ghost-combo.ts` implements
 * exactly that as `chainAfterPowerPellet`, and it is green. But `GameState`
 * carries no "ghosts eaten this fright" counter — see `game-state.ts`, which
 * lists every field — so there is nowhere for this system to write the reset
 * to, and a test could not observe it. What IS observable is the half of the
 * rule this system owns: an overlapping energizer REFRESHES one fright timer
 * rather than starting a second one, which is pinned below. The counter, and
 * the reset that goes with it, belong to whichever slice adds the field.
 */
describe('eatSystem', () => {
  /**
   * A plain dot, and an energizer, at coordinates chosen to be ASYMMETRIC.
   *
   * Both are deliberately off the diagonal: the transpose of the dot (col 8,
   * row 9) is a wall, and the transpose of the energizer (col 3, row 26) is a
   * plain dot. So an implementation that builds the tile with col and row the
   * wrong way round eats nothing at all in one test and scores 10 instead of 50
   * in the other, instead of quietly passing both. Read off
   * `maze/classic-layout.ts`: row 8 is `#......##....##....##......#` and row 3
   * is `#o####.#####.##.#####.####o#`.
   */
  const DOT: Tile = { col: 9, row: 8 };
  const ENERGIZER: Tile = { col: 26, row: 3 };

  /**
   * TYPE: unit.
   * WHY THIS TYPE: eating is a pure function of (board, tile, spec) already
   *   proven in `pacman/eat.ts`. What is unproven is the WIRING — that this
   *   system reads Pac-Man's tile, applies the points table, and hands the
   *   event on. A hand-built state shows all three in three assertions; a
   *   pipeline test would need Pac-Man to walk onto the dot first.
   * MEASURES: a dot scores 10, leaves the board, and is announced with the
   *   count that is left AFTER the bite.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.1, "Eating: 10 for a dot, 50
   *   for an energizer" — a dot is 10 points. Section 8.1, "The dot census:
   *   240 + 4 = 244" — a full board holds 244 items, so 243 remain once one is
   *   eaten.
   * CATCHES: a score that never moves, or a `remaining` read BEFORE the bite —
   *   which is off by one all level and tells the siren the board is one dot
   *   fuller than it is, so the last dot never triggers the level clear.
   * LOAD-BEARING: yes — the stub returns the state and no events.
   */
  it('scores a dot at 10, takes it off the board, and reports the count that is left', () => {
    /* 130 rather than 0: with a zero start, "score = points" and "score =
       previous + points" are the same number and the wrong one passes. */
    const state = buildState({ pacman: { actor: { position: centreOf(DOT) } }, score: 130 });

    const { state: next, events } = eatSystem.run(state, frameContext(), []);

    expect(next.score).toBe(140);
    expect(pelletAt(next.pellets, DOT)).toBe(PelletKind.None);
    expect(events).toEqual([{ kind: 'pelletEaten', tile: DOT, remaining: 243 }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: it is one field on Pac-Man plus five fields that must NOT
   *   have moved. Cheap to state, and impossible to state through a pipeline
   *   without the mode system also touching the fright timer.
   * MEASURES: a dot costs exactly one frame of movement, and frightens and
   *   reverses nobody.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.2, "The eating freeze: 1 frame
   *   for a dot, 3 for an energizer" — the Dossier's table gives a dot 1 frame.
   *   Section 6.6, "Fright" — only an energizer frightens the ghosts.
   * CATCHES: two bugs at once. A missing freeze makes Pac-Man permanently
   *   faster than every ghost (80% against 75% at level 1), so the game cannot
   *   be lost; and fright started on a plain dot makes the whole board edible
   *   and deletes the risk the other way.
   * LOAD-BEARING: yes — the stub leaves stopFrames at 0.
   */
  it('freezes Pac-Man for one frame on a dot, and turns nobody blue or around', () => {
    expect.assertions(10);
    const state = buildState({
      pacman: { actor: { position: centreOf(DOT) }, stopFrames: 0 },
    });

    const { state: next } = eatSystem.run(state, frameContext(), []);

    expect(next.pacman.stopFrames).toBe(1);
    expect(next.modes.frightenedFramesLeft).toBe(0);
    for (const id of GHOST_ORDER) {
      expect(next.ghosts[id].frightenedFramesLeft).toBe(0);
      expect(next.ghosts[id].reverseQueued).toBe(false);
    }
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the 50 and the forwarded duration are two independent
   *   lookups — one from the points table, one from the level spec — and a unit
   *   can put a level whose duration is NOT the default in front of the system.
   * MEASURES: an energizer scores 50, leaves the board, and its event carries
   *   the level's fright duration.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.1 — an energizer is 50 points.
   *   Section 3, the per-level table, level 1 row: `frightenedFrames` is 360
   *   (6 s at 60 Hz), which is the figure `levelSpec(1)` carries.
   * CATCHES: an energizer scored as a dot — 40 points a board, and the 2600
   *   full-board total a replay fixture is built from silently wrong — or an
   *   event with no duration on it, which leaves the audio director unable to
   *   time the frightened loop.
   * LOAD-BEARING: yes.
   */
  it('scores an energizer at 50 and announces the fright duration this level grants', () => {
    const state = buildState({ pacman: { actor: { position: centreOf(ENERGIZER) } }, score: 130 });

    const { state: next, events } = eatSystem.run(state, frameContext(), []);

    expect(next.score).toBe(180);
    expect(pelletAt(next.pellets, ENERGIZER)).toBe(PelletKind.None);
    expect(events).toEqual([{ kind: 'powerPelletEaten', tile: ENERGIZER, frames: 360 }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: "every ghost, including the ones in the house" is a claim
   *   about four records at once. The fixture is what makes it discriminating —
   *   three of the four ghosts start INSIDE the house, so an implementation
   *   that frightens only the ghosts on the board fails on three of the four
   *   assertions rather than on none.
   * MEASURES: that the fright timer is set on the wave clock AND on all four
   *   ghosts.
   * ORACLE: docs/ARCADE-REFERENCE.md section 6.6, "Fright" — "A power pellet
   *   frightens every ghost, including ghosts still inside the house."
   *   Section 3, level 1: 360 frames.
   * CATCHES: the two halves are separately fatal. Without the per-ghost timer
   *   `isFrightened` stays false, so the blue ghosts are still deadly and eat
   *   the player who did everything right; without the wave-clock timer the
   *   scatter/chase schedule is never paused (section 4), so every energizer
   *   silently spends six seconds of the player's scatter time.
   * LOAD-BEARING: yes.
   */
  it('frightens all four ghosts, including the three still inside the house', () => {
    expect.assertions(6);
    const state = buildState({ pacman: { actor: { position: centreOf(ENERGIZER) } } });
    /* The fixture's discriminating property, asserted rather than assumed. */
    expect(state.ghosts[GhostId.Inky].phase).toBe(GhostPhase.InHouse);

    const { state: next } = eatSystem.run(state, frameContext(), []);

    expect(next.modes.frightenedFramesLeft).toBe(360);
    for (const id of GHOST_ORDER) {
      expect(next.ghosts[id].frightenedFramesLeft).toBe(360);
    }
  });

  /**
   * TYPE: unit.
   * MEASURES: that an energizer queues a reversal on every ghost.
   * ORACLE: docs/ARCADE-REFERENCE.md section 4, "Reversal", quoting the
   *   Dossier: "Ghosts are forced to reverse direction by the system anytime the
   *   mode changes from: chase-to-scatter, chase-to-frightened,
   *   scatter-to-chase, and scatter-to-frightened." The same section states that
   *   the →frightened reversal is raised where the pellet is eaten, because
   *   `advanceModes` never reports it.
   * CATCHES: ghosts that keep walking straight at Pac-Man the instant he takes
   *   an energizer. The turn-around is what buys the player the ground to chase
   *   them into; without it the four-ghost chain is unobtainable and the pellet
   *   is worth 50 points and nothing else.
   * LOAD-BEARING: yes — every ghost starts with the flag clear.
   */
  it('turns every ghost around when the energizer goes, because nothing else will', () => {
    expect.assertions(4);
    const state = buildState({ pacman: { actor: { position: centreOf(ENERGIZER) } } });

    const { state: next } = eatSystem.run(state, frameContext(), []);

    for (const id of GHOST_ORDER) {
      expect(next.ghosts[id].reverseQueued).toBe(true);
    }
  });

  /**
   * TYPE: unit.
   * MEASURES: that the energizer freeze is 3 frames and REPLACES a freeze
   *   already pending rather than adding to it.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.2 — "Eating an energizer dot
   *   causes Pac-Man to stop moving for three frames", plus the [repo
   *   convention] recorded in the same section: "The two counts do not
   *   accumulate: eating an energizer while a dot's single frame is still
   *   pending sets the counter to 3 rather than to 4."
   * CATCHES: a `+=` instead of an `=`. It is invisible on any board where the
   *   freezes never overlap and it is the difference between a documented rule
   *   and an accident, which is exactly the kind of drift a replay fixture's
   *   exact frame count would later fail on for no discoverable reason.
   * LOAD-BEARING: yes — the stub leaves stopFrames at 1.
   */
  it('sets the energizer freeze to three frames rather than adding it to one already pending', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(ENERGIZER) }, stopFrames: 1 },
    });

    const { state: next } = eatSystem.run(state, frameContext(), []);

    expect(next.pacman.stopFrames).toBe(3);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the level-19 zero already has a table test. What is
   *   unproven is that a ZERO SURVIVES THE JOURNEY through this system instead
   *   of being treated as "unset" and defaulted — a claim about this file, and
   *   the cheapest place to make it is here.
   * MEASURES: at a level with no fright, an energizer still scores 50, still
   *   emits its event with `frames: 0`, frightens nobody, and still reverses
   *   everybody.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3, the per-level table: from level
   *   19 `frightenedFrames` is 0, and the note on `LevelSpec.frightenedFrames`
   *   states the consequence — "a power pellet still scores and still reverses
   *   the ghosts, but nobody turns blue".
   * CATCHES: `if (spec.frightenedFrames)`, a falsy check that either hands
   *   level 19 a full six-second fright — making the hardest levels in the game
   *   easier than level 1 — or skips the reversal along with the fright,
   *   removing the last thing an energizer is still good for up there.
   *   NOTE THE FIXTURE: the state stays at level 1 while the context carries
   *   level 19's spec, so an implementation that reads `state.level` instead of
   *   `ctx.spec` frightens everybody and fails.
   * LOAD-BEARING: yes.
   */
  it('scores 50 and still reverses the ghosts, but starts no fright, at level 19', () => {
    expect.assertions(10);
    const state = buildState({ pacman: { actor: { position: centreOf(ENERGIZER) } }, score: 130 });

    const { state: next, events } = eatSystem.run(state, frameContext({ spec: levelSpec(19) }), []);

    expect(next.score).toBe(180);
    expect(events).toEqual([{ kind: 'powerPelletEaten', tile: ENERGIZER, frames: 0 }]);
    for (const id of GHOST_ORDER) {
      expect(isFrightened(next.ghosts[id])).toBe(false);
      expect(next.ghosts[id].reverseQueued).toBe(true);
    }
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: the discriminating case is a state you cannot reach quickly
   *   in a pipeline — mid-fright, with 100 frames left — and it is one call to
   *   state it.
   * MEASURES: that an energizer taken while the ghosts are already blue
   *   REFRESHES the one fright timer to the level's full duration.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.2 — "This codebase treats an
   *   overlapping energizer as extending one fright rather than starting a
   *   second, because the fright timer is one global counter." Level 1's
   *   duration is 360 frames (section 3).
   * CATCHES: a `Math.max`-free implementation is not the risk here; the risk is
   *   an implementation that leaves the running timer alone because "fright is
   *   already on". The player who chains two energizers gets 100 frames of blue
   *   instead of 360 and loses the second half of the chain — 2400 points of
   *   it, on a full ladder.
   *   The fixture starts at 100, not at 0 and not at 360, so neither "left it
   *   alone" nor "it was already right" can pass.
   * LOAD-BEARING: yes.
   */
  it('refreshes the fright timer to its full length when a second energizer is taken mid-fright', () => {
    expect.assertions(5);
    const state = buildState({
      pacman: { actor: { position: centreOf(ENERGIZER) } },
      modes: { frightenedFramesLeft: 100 },
      ghosts: {
        [GhostId.Blinky]: { frightenedFramesLeft: 100 },
        [GhostId.Pinky]: { frightenedFramesLeft: 100 },
        [GhostId.Inky]: { frightenedFramesLeft: 100 },
        [GhostId.Clyde]: { frightenedFramesLeft: 100 },
      },
    });

    const { state: next } = eatSystem.run(state, frameContext(), []);

    expect(next.modes.frightenedFramesLeft).toBe(360);
    for (const id of GHOST_ORDER) {
      expect(next.ghosts[id].frightenedFramesLeft).toBe(360);
    }
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: `addScore` already owns the crossing arithmetic and has its
   *   own test. What this pins is that the eat system ACTS on the answer —
   *   pays the life, latches it, and says so — which no test of `addScore` can
   *   see.
   * MEASURES: the single dot that takes the score from 9995 to 10005 adds a
   *   life, sets the latch, and emits `extraLife` carrying the new count, after
   *   the `pelletEaten` that earned it.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.3, "The extra life: one, at
   *   10000 points" — 10000 is the cabinet's factory setting, and it is a
   *   CROSSING, not a threshold.
   * CATCHES: the bonus life never arriving. It is the reward the whole first
   *   level is played for, and nothing else in the game pays lives, so it fails
   *   silently — the player simply never gets one and there is nothing on
   *   screen that looks wrong.
   * LOAD-BEARING: yes.
   */
  it('pays the bonus life on the bite that crosses 10000, and announces the new count', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(DOT) } },
      score: 9995,
      lives: 3,
      extraLifeAwarded: false,
    });

    const { state: next, events } = eatSystem.run(state, frameContext(), []);

    expect(next.score).toBe(10005);
    expect(next.lives).toBe(4);
    expect(next.extraLifeAwarded).toBe(true);
    /* Order matters: the score has to have moved before anything claims a life
       was earned by it, and this list is read as an audio script. */
    expect(events).toEqual([
      { kind: 'pelletEaten', tile: DOT, remaining: 243 },
      { kind: 'extraLife', lives: 4 },
    ]);
  });

  /**
   * TYPE: unit.
   * MEASURES: that a dot eaten with the score already past 10000 pays nothing
   *   and says nothing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.3 — the table of wrong
   *   readings: `after >= 10000` gives "a life awarded on every scoring event
   *   after 10000; the player ends with ninety".
   * CATCHES: exactly that. An unlosable game, reached by any player good enough
   *   to pass 10000 — which is to say, by the ones most likely to notice.
   * LOAD-BEARING: yes, though only through its event assertion: the stub emits
   *   nothing where a `pelletEaten` is owed. The lives figure is the guard.
   */
  it('pays no second life for a dot eaten once the score is already past 10000', () => {
    const state = buildState({
      pacman: { actor: { position: centreOf(DOT) } },
      score: 12000,
      lives: 4,
      extraLifeAwarded: true,
    });

    const { state: next, events } = eatSystem.run(state, frameContext(), []);

    expect(next.score).toBe(12010);
    expect(next.lives).toBe(4);
    expect(events).toEqual([{ kind: 'pelletEaten', tile: DOT, remaining: 243 }]);
  });

  /**
   * TYPE: unit.
   * WHY THIS TYPE: object identity is not observable from anywhere except the
   *   return value of this call.
   * MEASURES: that a frame in which Pac-Man is standing on nothing returns the
   *   VERY SAME state object, not a copy of it, and emits nothing.
   * ORACLE: the contract stated on `unchanged` and `runSystems` in
   *   `game/system.ts`: "A system that changes nothing costs nothing. The state
   *   object is threaded through by reference, never defensively copied." This
   *   runs on the great majority of the sixty frames in a second, since Pac-Man
   *   is on a dot tile only occasionally.
   * CATCHES: an unconditional `{ ...state }`, which is invisible to every value
   *   assertion in this file and defeats every `toBe` identity check
   *   downstream — including the ones that let later slices ask "did this frame
   *   change anything at all?" without comparing whole worlds.
   * LOAD-BEARING: no — the stub returns `unchanged(state)` too, so this passes
   *   in the red phase. It is a guard, and a deliberate one: it is the only
   *   test here that constrains the case where NOTHING is under Pac-Man, which
   *   is the common case. Pac-Man's spawn tile carries no dot, so the default
   *   fixture is already standing on empty floor.
   */
  it('returns the same state object, untouched, when there is nothing to eat', () => {
    const state = buildState();

    const result = eatSystem.run(state, frameContext(), []);

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });
});
