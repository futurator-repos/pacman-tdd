import { describe, expect, it } from 'vitest';

import { RoundPhase } from '../game/game-phase.ts';
import { startGame } from '../game/new-game.ts';
import { GhostId } from '../ghost/ghost-id.ts';
import { GhostPhase } from '../ghost/ghost.ts';

import { buildState } from './state-builder.ts';

/**
 * The fixture builder, tested as production code — because it is.
 *
 * Every system test in slices s10 and s11 begins with a call to `buildState`.
 * If the world it hands out is subtly illegal, those tests are asserting
 * outcomes for a situation the game can never reach, and every one of them
 * passes while protecting nothing. That is the most expensive kind of test
 * defect there is: it does not fail, and it does not warn.
 *
 * So there are exactly three questions here, and they are the three ways a
 * fixture builder goes wrong:
 *
 *   1. Is the world it starts from a REAL one, or an invention that drifts away
 *      from what `startGame` actually produces?
 *   2. Does a patch actually take effect?
 *   3. Does a patch take effect WITHOUT quietly destroying its neighbours?
 *
 * Question 3 is the one that costs a day. A shallow merge of
 * `{ ghosts: { inky: { phase } } }` replaces the entire ghosts record with one
 * ghost, and the failure surfaces four files away as "Blinky is undefined".
 */

describe('buildState', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: One call compared against another call. Nothing to
   *   integrate: the claim is a relationship between two functions, which is
   *   exactly what one assertion can state.
   * MEASURES: That the builder's base is a REAL started game rather than a
   *   parallel hand-written world — identical to `startGame()` in every field
   *   but the phase, which is moved on to `playing`.
   * ORACLE: docs/ARCHITECTURE.md, slice s09: "state-builder produces a legal
   *   GameState", and "no test hand-builds a valid one". Deriving the
   *   expectation FROM startGame is the whole point: any future field added to
   *   GameState is automatically covered, and a builder that forgets to set it
   *   fails here rather than in whichever s11 test happened to read it.
   *   The `playing` phase is this slice's stated decision (see state-builder.ts):
   *   a fixture wants a running game, because a builder that handed back the
   *   ready countdown would mean every system test opened by skipping it — and
   *   the test that forgot would assert "nothing moved" and pass.
   * CATCHES: A builder that invents its own defaults — three lives here, two
   *   there — so that fixtures and real games slowly diverge and a rule proved
   *   on a fixture turns out not to hold in play. Also catches a builder still
   *   sitting in the ready phase, which would freeze every later system test at
   *   frame zero and make "the ghosts did not move" the expected result of
   *   everything.
   * LOAD-BEARING: yes — the stub builder returns a different inert state from
   *   the stub startGame, and neither is in the playing phase.
   */
  it('starts from a real started game, moved on to the playing phase', () => {
    expect(buildState()).toEqual({
      ...startGame(),
      phase: RoundPhase.Playing,
      phaseFramesLeft: 0, // the playing phase has no countdown: ARCADE-REFERENCE section 7.2
    });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A patch is a value transformation; comparing the patched
   *   state against the unpatched one names exactly what changed and asserts
   *   that nothing else did, in one diff.
   * MEASURES: That top-level fields named in the patch are applied, and that
   *   every field NOT named keeps its default.
   * ORACLE: docs/ARCHITECTURE.md: "buildState(patch) -> GameState. Produces a
   *   legal state from the three or four fields a test actually cares about."
   *   The expectation is written as "the default state, plus these three
   *   fields", which is the definition of a patch.
   * CATCHES: A builder that ignores its argument (every fixture identical, so
   *   twenty tests all secretly test the same situation and any one of them
   *   could be deleted with no effect), or one that returns ONLY the patched
   *   fields, which is an illegal state that will crash the first system to
   *   read a field nobody patched.
   * LOAD-BEARING: yes — the stub ignores the patch entirely.
   */
  it('applies the fields named in the patch and leaves every other field at its default', () => {
    const patched = buildState({ score: 4260, lives: 1, level: 5 });

    expect(patched).toEqual({
      ...buildState(),
      score: 4260,
      lives: 1,
      level: 5,
    });
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Two nested patches at two different depths, in one test,
   *   because the behaviour under test is "the merge goes as deep as the patch
   *   does" and a single depth cannot show that. Still a unit: one call, one
   *   value, no game.
   * MEASURES: That `{ ghosts: { inky: { phase } } }` changes Inky's phase and
   *   nothing else about Inky, nothing at all about the other three ghosts; and
   *   that a three-level patch of Pac-Man's pixel position leaves his facing
   *   alone AND leaves the actor's siblings on `pacman` alone.
   * ORACLE: docs/ARCHITECTURE.md, slice s09: "a deeply nested patch (one
   *   ghost's phase) leaves every other ghost untouched." The expectations are
   *   written as "the default record, with one field replaced", which is what a
   *   deep merge means.
   * CATCHES: The shallow-merge bug, which is the default behaviour of the
   *   obvious one-line implementation `{ ...base, ...patch }`. It replaces the
   *   whole ghosts record with the single ghost mentioned, so `state.ghosts`
   *   loses three ghosts, and it replaces Pac-Man's whole actor with a bare
   *   position, so he has no facing at all. Neither failure appears here — it
   *   appears in slice s11 as an unreadable crash inside the ghost system,
   *   pointing at code that is perfectly correct.
   * LOAD-BEARING: yes — the stub ignores the patch, so Inky is still in the
   *   house and Pac-Man is still at the pixel origin.
   */
  it("merges as deep as the patch goes, leaving the other ghosts and Pac-Man's facing alone", () => {
    const base = buildState();

    const patched = buildState({
      ghosts: { [GhostId.Inky]: { phase: GhostPhase.Hunting } },
      pacman: { actor: { position: { x: 100, y: 164 } } },
    });

    expect(patched.ghosts).toEqual({
      ...base.ghosts,
      [GhostId.Inky]: { ...base.ghosts[GhostId.Inky], phase: GhostPhase.Hunting },
    });
    /* Asserted on `pacman`, not on `pacman.actor`. Looking only at the actor
       would miss a merge that got the third level right and dropped the second:
       `{ ...base, pacman: { actor: merged } }` produces exactly the actor
       expected here while losing `pendingDirection`, `stopFrames` and
       `animationFrame`. The ghosts assertion above guards its own intermediate
       level; this one has to guard Pac-Man's. */
    expect(patched.pacman).toEqual({
      ...base.pacman,
      actor: { ...base.pacman.actor, position: { x: 100, y: 164 } },
    });
  });
});
