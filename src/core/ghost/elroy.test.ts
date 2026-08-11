import { describe, expect, it } from 'vitest';

import { Direction } from '../geometry/direction.ts';
import { levelSpec } from '../rules/level-table.ts';

import { elroyStage } from './elroy.ts';
import { GhostId } from './ghost-id.ts';
import { type Ghost, GhostPhase } from './ghost.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * "Cruise Elroy" is the name players gave to the thing that happens to Blinky
 * near the end of a level: he speeds up, twice, and stops behaving like one of
 * four ghosts. It is the entire late-level difficulty ramp, and it is driven by
 * one integer — how many dots are LEFT.
 *
 * Two mistakes are easy here and both survive casual play:
 *
 *   1. Reading the threshold as dots EATEN rather than dots REMAINING. Blinky
 *      then sprints at the start of a level and calms down at the end. Precisely
 *      inverted, still "working", and nothing crashes.
 *   2. Forgetting that Elroy is SUSPENDED while any ghost is still in the house.
 *      After a death, with three ghosts penned, Blinky would go Elroy
 *      immediately — and the level becomes brutally hard for a reason no bug
 *      report will ever manage to articulate.
 *
 * ---------------------------------------------------------------------------
 * WHY THE THRESHOLDS ARE READ FROM THE SPEC AND ASSERTED AS LITERALS
 *
 * The numbers below (20/10 at level 1, 40/20 at level 5) are literals taken from
 * docs/ARCADE-REFERENCE.md section 3, not `LEVEL_1.elroy1DotsLeft`. Writing
 * `elroyStage({ dotsRemaining: LEVEL_1.elroy1DotsLeft, ... })` would test the
 * rule against whatever the table happens to say and would keep passing if the
 * table changed — the expectation has to come from the document. `levelSpec` is
 * still the INPUT, because the rule genuinely must read the spec rather than a
 * constant of its own, and the level-5 test is what proves it does.
 * ---------------------------------------------------------------------------
 */

const LEVEL_1 = levelSpec(1);
const LEVEL_5 = levelSpec(5);

const IDLE_ACTOR = {
  position: { x: 0, y: 0 },
  facing: Direction.Left,
  queued: null,
  carrySubPixels: 0,
};

function ghostIn(id: GhostId, phase: GhostPhase): Ghost {
  return {
    id,
    actor: IDLE_ACTOR,
    phase,
    frightenedFramesLeft: 0,
    dotCounter: 0,
    dotCounterActive: false,
    elroyStage: 0,
    reverseQueued: false,
  };
}

/** Every ghost out on the board — the only state in which Elroy runs at all. */
const HOUSE_EMPTY: Readonly<Record<GhostId, Ghost>> = {
  [GhostId.Blinky]: ghostIn(GhostId.Blinky, GhostPhase.Hunting),
  [GhostId.Pinky]: ghostIn(GhostId.Pinky, GhostPhase.Hunting),
  [GhostId.Inky]: ghostIn(GhostId.Inky, GhostPhase.Hunting),
  [GhostId.Clyde]: ghostIn(GhostId.Clyde, GhostPhase.Hunting),
};

/** The same board with Clyde still penned, which suspends Elroy. */
const CLYDE_IN_HOUSE: Readonly<Record<GhostId, Ghost>> = {
  ...HOUSE_EMPTY,
  [GhostId.Clyde]: ghostIn(GhostId.Clyde, GhostPhase.InHouse),
};

describe('elroyStage', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: a two-step threshold function over one integer. Four calls
   *   pin both comparison operators from both sides. An integration test would
   *   give one sample somewhere in the middle of a band and leave `>=` versus
   *   `>` — the only question here — completely open.
   * MEASURES: at level 1, whose thresholds are 20 and 10 dots remaining:
   *     21 left -> 0 (one dot above the first threshold)
   *     20 left -> 1 (at it)
   *     11 left -> 1 (one dot above the second)
   *     10 left -> 2 (at it)
   *      0 left -> 2 (and it stays there)
   * ORACLE: docs/ARCADE-REFERENCE.md section 3, the Elroy1/Elroy2 dots columns
   *   for level 1 — 20 and 10 — read as dots REMAINING, per section 5.
   * CATCHES: the threshold read as dots eaten, which inverts the difficulty
   *   curve; and `>` for `>=`, which delays each stage by one dot and makes
   *   stage 2 unreachable on the last dot of a level.
   * LOAD-BEARING: yes for four of the five expectations — the stub returns 0, so
   *   only the first (21 left -> 0) passes, and it passes for the wrong reason.
   */
  it('engages stage 1 at twenty dots remaining and stage 2 at ten, on level 1', () => {
    const at = (dotsRemaining: number): number =>
      elroyStage({ dotsRemaining, spec: LEVEL_1, ghosts: HOUSE_EMPTY });

    expect(at(21)).toBe(0);
    expect(at(20)).toBe(1);
    expect(at(11)).toBe(1);
    expect(at(10)).toBe(2);
    expect(at(0)).toBe(2);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: the same rule at a different level, which is the only way to
   *   distinguish a rule that reads its LevelSpec from one that hard-codes level
   *   1's numbers and is right by accident for the first minute of the game.
   * MEASURES: at level 5, whose thresholds are 40 and 20:
   *     41 left -> 0    40 left -> 1    21 left -> 1    20 left -> 2
   *   Note that 20 dots remaining is stage 1 at level 1 and stage 2 at level 5,
   *   so a single hard-coded pair of numbers cannot satisfy both tests.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3, the Elroy columns for level 5 —
   *   40 and 20 dots remaining.
   * CATCHES: thresholds hard-coded at 20 and 10. Blinky's acceleration then
   *   arrives at the same moment on every level, and the deliberate ramp through
   *   the table (20/10 at level 1 up to 120/60 at level 19) never happens.
   * LOAD-BEARING: yes for three of the four — the stub returns 0.
   */
  it('takes both thresholds from the level spec, so level 5 engages at forty and twenty', () => {
    const at = (dotsRemaining: number): number =>
      elroyStage({ dotsRemaining, spec: LEVEL_5, ghosts: HOUSE_EMPTY });

    expect(at(41)).toBe(0);
    expect(at(40)).toBe(1);
    expect(at(21)).toBe(1);
    expect(at(20)).toBe(2);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: an easily-omitted qualifier on a rule already pinned above.
   *   It gets its own named test so that deleting the qualifier produces a
   *   failure whose NAME explains the bug, rather than a Blinky who is subtly
   *   too fast in a situation nobody thinks to reproduce.
   * MEASURES: five dots remaining — below both of level 1's thresholds, so the
   *   test above says stage 2 — with Clyde still in phase InHouse. The answer is
   *   0: Elroy is suspended, and Blinky reverts to the ordinary ghost speed.
   * ORACLE: docs/ARCADE-REFERENCE.md section 5, quoting the Dossier: Elroy is
   *   suspended while any ghost remains inside the house and resumes when the
   *   house is empty.
   * CATCHES: the house check dropped in a later refactor. Blinky goes Elroy the
   *   instant a life is lost, while the other three are still penned, so the
   *   frames right after a death — already the hardest in the game — get an
   *   85%-speed Blinky bearing down on a stationary Pac-Man.
   * LOAD-BEARING: NO, and deliberately so. The do-nothing stub returns 0, which
   *   is the expected answer, so this test passes in the RED phase and pins
   *   nothing on its own. It is a GUARD in the sense of docs/TDD-FINDINGS.md,
   *   "the stub is a measuring instrument": it becomes valuable only once the
   *   two tests above are green, at which point it is the only thing standing
   *   between the codebase and a rule that is right except after a death. The
   *   pairing — a load-bearing rule and a guard on its qualifier — is worth
   *   seeing, which is why the guard is kept rather than strengthened into a
   *   test that would duplicate the first one.
   */
  it('suspends cruise elroy entirely while any ghost is still inside the house', () => {
    expect(elroyStage({ dotsRemaining: 5, spec: LEVEL_1, ghosts: CLYDE_IN_HOUSE })).toBe(0);
  });
});
