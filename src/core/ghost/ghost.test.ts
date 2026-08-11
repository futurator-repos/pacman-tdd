import { describe, expect, it } from 'vitest';

import { Direction } from '../geometry/direction.ts';

import { GhostId } from './ghost-id.ts';
import { type Ghost, GhostPhase, isFrightened } from './ghost.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * One modelling decision is under test here, and it is worth more than the four
 * lines of code it protects: fright is a TIMER that runs alongside whatever a
 * ghost is already doing, not a PHASE the ghost is in.
 *
 * The arcade fact that forces it (docs/ARCADE-REFERENCE.md): eating a power
 * pellet turns EVERY ghost blue, including ones still sitting in the house and
 * ones already on their way out of it. A `GhostPhase.Frightened` cannot express
 * "frightened AND in the house" without also remembering which phase to restore
 * afterwards — two sources of truth that drift apart, and the origin of the
 * classic "the ghost forgot it was Eyes" bug.
 *
 * `Actor` (slice s03) and `GhostId` (slice s02) live in modules built in
 * parallel with this slice. They are imported as types only where needed, which
 * `verbatimModuleSyntax` erases entirely, so this file executes and fails on
 * assertions rather than on "Cannot find module".
 */

/** A ghost in whatever phase, with whatever is left on its fright timer.
 *  Everything else is filler: `isFrightened` may read one field and one only. */
function ghostIn(phase: GhostPhase, frightenedFramesLeft: number): Ghost {
  return {
    id: GhostId.Pinky,
    actor: {
      position: { x: 108, y: 116 },
      facing: Direction.Left,
      queued: null,
      carrySubPixels: 0,
    },
    phase,
    frightenedFramesLeft,
    dotCounter: 0,
    dotCounterActive: false,
    elroyStage: 0,
    reverseQueued: false,
  };
}

describe('isFrightened', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: a one-line predicate over a single number. A unit is the
   *   cheapest thing that fully exercises it, and it names the broken function
   *   directly. Reaching the same fact through a tick would leave three
   *   suspects — the timer, the phase, or the pipeline — for one bug.
   * MEASURES: that a ghost whose phase is InHouse and whose fright timer is
   *   still running counts as frightened. That is the assertion that makes
   *   fright orthogonal to phase rather than a member of it.
   * ORACLE: docs/ARCADE-REFERENCE.md — a power pellet frightens all four
   *   ghosts, including any still inside the house; the house does not shelter
   *   a ghost from fright. The absence of a Frightened phase follows from that
   *   arcade fact, not from a design preference.
   * CATCHES: someone modelling fright as `GhostPhase.Frightened`. Ghosts in the
   *   house stay pink while the rest turn blue, they cannot be eaten on the way
   *   out, and every phase transition now has to remember and restore the phase
   *   it interrupted.
   * LOAD-BEARING: yes — the do-nothing stub returns `false`.
   */
  it('is true for a ghost still inside the house, because fright is a timer and not a phase', () => {
    expect(isFrightened(ghostIn(GhostPhase.InHouse, 120))).toBe(true);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: same predicate, all five phases. A loop over the phase
   *   vocabulary is exhaustive by construction, so adding a sixth phase later
   *   automatically extends the guarantee instead of quietly escaping it.
   * MEASURES: that the phase is not consulted at all — the answer depends only
   *   on the timer.
   * ORACLE: docs/ARCADE-REFERENCE.md — fright applies to a ghost in any state;
   *   the eyes of an eaten ghost are the sole exception in the ARCADE only
   *   because they are already eaten, which the collision rule handles, not
   *   this predicate.
   * CATCHES: a `phase === Hunting &&` creeping into the condition, which would
   *   silently un-blue every ghost that is leaving the house at the moment a
   *   power pellet is eaten.
   * LOAD-BEARING: yes — the stub returns `false` for every phase.
   */
  it('is true in every phase while the timer is running', () => {
    /* Vacuity guard: an empty phase vocabulary would make this loop assert
       nothing at all while still reporting success. */
    expect.assertions(5);

    for (const phase of Object.values(GhostPhase)) {
      expect(isFrightened(ghostIn(phase, 1))).toBe(true);
    }
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: the boundary of the same predicate. Cheapest possible.
   * MEASURES: that zero frames left is NOT frightened — the ghost is dangerous
   *   again on the very frame the timer reaches zero, not one frame later.
   * ORACLE: docs/ARCADE-REFERENCE.md — the fright period lasts exactly the
   *   number of frames in the level table (level 1: 360 frames = 6 seconds);
   *   when it is spent the ghosts revert immediately.
   * CATCHES: `>= 0` written for `> 0`, which would leave every ghost
   *   permanently edible and make the game unlosable.
   * LOAD-BEARING: no — a stub returning `false` satisfies this, so it is a
   *   guard rather than a specification. Kept deliberately: it is the boundary
   *   of the test above, and the pair is what pins the exact frame of the
   *   transition. Classified per docs/TDD-FINDINGS.md as (b) weak, not (a)
   *   vacuous: its assertion really does execute.
   */
  it('is false on the frame the timer reaches zero', () => {
    expect(isFrightened(ghostIn(GhostPhase.Hunting, 0))).toBe(false);
  });
});

describe('GhostPhase', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: pinning a vocabulary is pure data comparison. Nothing more
   *   expensive can add information.
   * MEASURES: the five phases, and — the actual point — that `frightened` is
   *   NOT among them.
   * ORACLE: docs/ARCADE-REFERENCE.md, plus docs/ARCHITECTURE.md's Ghost
   *   section: a ghost is in the house, leaving it, hunting, returning as eyes,
   *   or re-entering. Fright is orthogonal to all five.
   * CATCHES: a well-meaning `Frightened: 'frightened'` being added to this
   *   object. The test fails with the added member visible in the diff, and the
   *   reader is sent to `isFrightened` above to find out why it must not exist.
   * LOAD-BEARING: no — GhostPhase is vocabulary, not behaviour, so it ships
   *   complete in the RED commit exactly as `Direction` did in slice s01, and
   *   this test passes from the first run. It pins meaning against future
   *   edits, which is a different job from driving an implementation.
   */
  it('has five phases and no frightened phase, because fright is a timer', () => {
    expect(Object.values(GhostPhase)).toEqual([
      'inHouse',
      'leavingHouse',
      'hunting',
      'eyes',
      'enteringHouse',
    ]);
  });
});
