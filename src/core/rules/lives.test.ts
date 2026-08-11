import { describe, expect, it } from 'vitest';

import { LifeOutcome, loseLife } from './lives.ts';

/**
 * Losing a life.
 *
 * Three lives is where a game starts (docs/ARCADE-REFERENCE.md section 7.1, a
 * [repo convention] fixing the cabinet's factory DIP setting), so the interesting
 * inputs are 3, 2, 1 and 0 — a very small domain, stated exhaustively below
 * rather than sampled.
 *
 * `loseLife` reports an outcome VALUE, not a `RoundPhase` and not a `GameEvent`.
 * That is a slice-dependency fact rather than a design preference: both of those
 * types live in `src/core/game/`, which is slice s09, and s09 depends on this
 * slice. Turning `gameOver` into a phase change and an event carrying the final
 * score is `life-system`'s job in slice s11 and is tested there. Section 13.6
 * records the split so that a reader looking for "the gameOver event carries the
 * score" knows which file to open.
 */
describe('loseLife', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: A pure transition over one integer. The respawn PATH — actors
   *   back on their spawn tiles, the house counters switched over — is a system
   *   concern tested through the pipeline in slice s11; what belongs here is the
   *   arithmetic and the branch, and nothing else.
   * MEASURES: That a death with lives in reserve spends exactly one and asks for
   *   a respawn, from a full three and from two.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.6: with more than one life left,
   *   one life is spent and the round restarts. Section 7.1 sets the starting
   *   count at 3.
   * CATCHES: An off-by-one that spends no life, giving the player an infinite
   *   supply, or one that spends two and ends the game a death early. Both are
   *   invisible in any test that only checks the game-over branch.
   * LOAD-BEARING: yes (the stub reports zero lives left).
   */
  it('spends one life and asks for a respawn while pac-man still has one in reserve', () => {
    expect.assertions(4);

    expect(loseLife(3).lives).toBe(2);
    expect(loseLife(3).outcome).toBe(LifeOutcome.Respawn);
    expect(loseLife(2).lives).toBe(1);
    expect(loseLife(2).outcome).toBe(LifeOutcome.Respawn);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The boundary of the same branch, one call away from the test
   *   above. Keeping the pair in one file is the point — the bug being hunted is
   *   the boundary between them, and a reader can see both readings at once.
   * MEASURES: That the last life lost leaves nothing in reserve and ends the
   *   game.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.6: at exactly one life, the life
   *   is spent and the outcome is game over.
   * CATCHES: A comparison written `lives > 0` instead of `lives > 1`, which gives
   *   the player a free fourth life and a round played with a lives count of
   *   zero — the HUD shows none left while the game refuses to end.
   * LOAD-BEARING: yes (the stub asks for a respawn).
   */
  it('ends the game on the last life and leaves nothing in reserve', () => {
    expect.assertions(2);

    expect(loseLife(1).lives).toBe(0);
    expect(loseLife(1).outcome).toBe(LifeOutcome.GameOver);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A totality question about a pure function, and the only place
   *   it can be asked: the game is over by then, so no amount of play reaches
   *   this input. A direct call is the whole of the available evidence.
   * MEASURES: loseLife(0) — a death claimed with no lives left.
   * ORACLE: docs/ARCADE-REFERENCE.md section 13.6, the zero row: the count stays
   *   at zero and the outcome is game over. Stated as a [repo convention]
   *   totality rule, not as an arcade fact.
   * CATCHES: A negative lives count, which renders as -1 life icons in the HUD
   *   and, if the game-over branch is written as an equality, never ends the game
   *   at all. The game becomes unloseable — a second bug that only exists because
   *   of a first one, which is exactly the kind that survives a release.
   * LOAD-BEARING: yes, and unexpectedly so: the stub happens to report the right
   *   lives count but the wrong outcome, so the assertion on `outcome` fails. It
   *   was written as a guard and it turned out to pin something.
   */
  it('never counts below zero when a life is lost with none left', () => {
    expect.assertions(2);

    expect(loseLife(0).lives).toBe(0);
    expect(loseLife(0).outcome).toBe(LifeOutcome.GameOver);
  });
});
