import { describe, expect, it } from 'vitest';

import { Direction } from '../geometry/direction.ts';

import { GhostId } from './ghost-id.ts';
import { type Ghost, GhostPhase } from './ghost.ts';
import { type HouseState, houseAfterDot, houseAfterFrame, releaseDecision } from './house.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * Blinky starts on the board; the other three start penned inside the house and
 * come out one at a time. Three independent rules can release a ghost, and a
 * re-implementation that leaves any of them out still LOOKS like Pac-Man:
 *
 *   1. PERSONAL DOT COUNTERS — Pinky at 0 dots, Inky at 30, Clyde at 60 on
 *      level 1. This is what paces the opening of a level.
 *   2. THE GLOBAL COUNTER — after a life is lost the machine switches to one
 *      shared counter with limits 7, 17 and 32, and the personal counters are
 *      ignored entirely.
 *   3. THE FOUR-SECOND TIMER — eat nothing for four seconds and the
 *      highest-priority ghost still in the house leaves anyway.
 *
 * Rule 3 exists to break a stalemate: without it a player who parks in a corner
 * and stops eating faces one ghost for the rest of the level. That is the sort
 * of rule nobody notices is missing until a player finds it, which is precisely
 * why it gets a named test.
 *
 * Everything here is arithmetic over counters, so every test is a unit. Reaching
 * 60 dots through the game would mean simulating a minute of play to assert one
 * ghost id.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS MODULE DELIBERATELY DOES NOT OWN
 *
 * `releaseDecision` answers "who may leave this frame" and nothing else. It does
 * not move the ghost, does not change its phase, and does not decide which
 * ghost's personal counter a swallowed dot increments — those are transitions,
 * and they belong to the house SYSTEM in slice s11. Keeping the decision
 * separate from the transition is what lets every case below be one call and one
 * assertion. docs/ARCADE-REFERENCE.md section 12.2 records the same split.
 * ---------------------------------------------------------------------------
 */

/** Ghosts in the house are not moving; the actor is required, and irrelevant. */
const PENNED_ACTOR = {
  position: { x: 0, y: 0 },
  facing: Direction.Left,
  queued: null,
  carrySubPixels: 0,
};

/** A ghost waiting inside the house, with its personal dot counter at `dots`. */
function waiting(id: GhostId, dots: number): Ghost {
  return {
    id,
    actor: PENNED_ACTOR,
    phase: GhostPhase.InHouse,
    frightenedFramesLeft: 0,
    dotCounter: dots,
    dotCounterActive: true,
    elroyStage: 0,
    reverseQueued: false,
  };
}

/** A ghost already out on the board, and therefore never a release candidate. */
function outside(id: GhostId): Ghost {
  return { ...waiting(id, 0), phase: GhostPhase.Hunting, dotCounterActive: false };
}

/**
 * The four ghosts, with Blinky out on the board where every level starts him.
 *
 * A named helper rather than four object literals per test, because the shape is
 * noise and the three phases and counters are the whole point of each case.
 *
 * THE KEYS ARE INSERTED BACKWARDS ON PURPOSE — Clyde first, Blinky last. A
 * `Record<GhostId, Ghost>` keeps its insertion order, so a fixture written in
 * `GHOST_ORDER` would make "scans in GHOST_ORDER" and "scans in whatever order
 * `Object.keys` returns" produce the SAME answer, and the release-order test
 * below would be evidence for neither. Reversed, an implementation that
 * enumerates the record instead of `GHOST_ORDER` names Clyde where Pinky is
 * expected, and says so out loud.
 */
function pen(pinky: Ghost, inky: Ghost, clyde: Ghost): Readonly<Record<GhostId, Ghost>> {
  return {
    [GhostId.Clyde]: clyde,
    [GhostId.Inky]: inky,
    [GhostId.Pinky]: pinky,
    [GhostId.Blinky]: outside(GhostId.Blinky),
  };
}

/** A level in progress: no life lost yet, and a dot eaten this very frame. */
const FRESH: HouseState = {
  globalCounter: 0,
  globalCounterActive: false,
  framesSinceDot: 0,
};

/** After a life is lost: the global counter is running at `count`. */
function afterDeath(count: number): HouseState {
  return { globalCounter: count, globalCounterActive: true, framesSinceDot: 0 };
}

describe('releaseDecision', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: pure arithmetic over counters, so a unit can jump straight to
   *   29 dots and then to 30. An integration test would have to eat sixty real
   *   dots to assert one integer boundary, and would still only sample one side
   *   of it.
   * MEASURES: at level 1, with each ghost's counter set to the dots eaten so
   *   far: Pinky is named at 0; with Pinky out, nobody is named at 29 and Inky
   *   is named at 30; with Inky out, nobody at 59 and Clyde at 60. Each
   *   threshold is asserted on BOTH sides in the same test, so no constant
   *   answer can satisfy it.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.1 — the level-1 personal limits
   *   are Pinky 0, Inky 30, Clyde 60, and a limit of 0 means "immediately", so
   *   the comparison is `counter >= limit`.
   * CATCHES: `>` written for `>=`. Every ghost then leaves exactly one dot late
   *   and Pinky never leaves at all on a level whose limit is 0 — which from
   *   level 3 on is every ghost, so the house simply never opens.
   * LOAD-BEARING: yes — the stub answers null to everything, and three of these
   *   six expectations name a ghost.
   */
  it('releases pinky at zero dots, inky at thirty and clyde at sixty on level 1', () => {
    expect(
      releaseDecision({
        house: FRESH,
        ghosts: pen(waiting(GhostId.Pinky, 0), waiting(GhostId.Inky, 0), waiting(GhostId.Clyde, 0)),
        level: 1,
      }),
    ).toBe(GhostId.Pinky);

    const withPinkyOut = (dots: number): Readonly<Record<GhostId, Ghost>> =>
      pen(outside(GhostId.Pinky), waiting(GhostId.Inky, dots), waiting(GhostId.Clyde, dots));

    expect(releaseDecision({ house: FRESH, ghosts: withPinkyOut(29), level: 1 })).toBeNull();
    expect(releaseDecision({ house: FRESH, ghosts: withPinkyOut(30), level: 1 })).toBe(
      GhostId.Inky,
    );

    const withInkyOut = (dots: number): Readonly<Record<GhostId, Ghost>> =>
      pen(outside(GhostId.Pinky), outside(GhostId.Inky), waiting(GhostId.Clyde, dots));

    expect(releaseDecision({ house: FRESH, ghosts: withInkyOut(59), level: 1 })).toBeNull();
    expect(releaseDecision({ house: FRESH, ghosts: withInkyOut(60), level: 1 })).toBe(
      GhostId.Clyde,
    );
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: the same rule at a different level, which is the only way to
   *   tell a module that READS the section 12.1 table from one that hard-codes
   *   level 1's row and is right for the first minute of every game. Nothing
   *   else in this file can: the four-second test reaches level 5 only with the
   *   global counter active, so the personal limits are never consulted there.
   * MEASURES: level 2, whose limits are Pinky 0, Inky 0, Clyde 50. With Pinky
   *   already out and Inky penned on ZERO dots, Inky is named immediately — at
   *   level 1 that same state names nobody, because Inky's limit is 30 there.
   *   Then with both out, Clyde is nobody at 49 and Clyde at 50, where level 1
   *   would still be waiting for 60.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.1 — the personal limits are
   *   0/30/60 at level 1, 0/0/50 at level 2 and 0/0/0 from level 3 on.
   * CATCHES: the level-1 row hard-coded, or the `level` argument ignored. Every
   *   level after the first opens at level-1 pace, so the deliberate ramp — by
   *   level 3 the whole house empties before the first dot — never happens, and
   *   the test above stays green forever.
   * LOAD-BEARING: yes — the stub answers null, and two of these three
   *   expectations name a ghost.
   */
  it('takes the personal limits from the level: at level 2 inky leaves at once and clyde at fifty', () => {
    expect(
      releaseDecision({
        house: FRESH,
        ghosts: pen(outside(GhostId.Pinky), waiting(GhostId.Inky, 0), waiting(GhostId.Clyde, 0)),
        level: 2,
      }),
    ).toBe(GhostId.Inky);

    const clydeAlone = (dots: number): Readonly<Record<GhostId, Ghost>> =>
      pen(outside(GhostId.Pinky), outside(GhostId.Inky), waiting(GhostId.Clyde, dots));

    expect(releaseDecision({ house: FRESH, ghosts: clydeAlone(49), level: 2 })).toBeNull();
    expect(releaseDecision({ house: FRESH, ghosts: clydeAlone(50), level: 2 })).toBe(GhostId.Clyde);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: an ordering claim needs a state in which several answers are
   *   simultaneously eligible — which is exactly the state a correct
   *   implementation is never allowed to resolve into more than one ghost.
   * MEASURES: with all three penned and every personal limit satisfied (60 dots
   *   eaten clears Pinky's 0, Inky's 30 and Clyde's 60 at once), the answer is
   *   Pinky and nothing else: one ghost per frame, earliest in GHOST_ORDER.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.4 — the house releases Pinky,
   *   then Inky, then Clyde, one at a time.
   * CATCHES: a rule that returns everyone whose counter has passed, or that
   *   scans the ghosts in whatever order `Object.keys` gives. The opening of a
   *   level after a slow start becomes a three-ghost swarm leaving the house
   *   abreast, which no single-ghost test would ever reveal.
   * LOAD-BEARING: yes — the stub answers null.
   */
  it('names one ghost per frame, the earliest still waiting, when several are eligible', () => {
    expect(
      releaseDecision({
        house: FRESH,
        ghosts: pen(
          waiting(GhostId.Pinky, 60),
          waiting(GhostId.Inky, 60),
          waiting(GhostId.Clyde, 60),
        ),
        level: 1,
      }),
    ).toBe(GhostId.Pinky);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: a mode switch inside one module, driven by one flag. A unit
   *   sets both worlds side by side in the same file; an integration test could
   *   show that the switch happened but not that the personal counters STOPPED
   *   BEING CONSULTED, which is the half that goes wrong.
   * MEASURES: with the global counter active, every penned ghost carries a
   *   personal counter of 999 — far past every limit in section 12.1 — and is
   *   still not released until the GLOBAL count reaches its own limit: nobody at
   *   5, Pinky at 7; nobody at 16, Inky at 17; nobody at 31, Clyde at 32.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.2 — losing a life switches the
   *   machine to a global dot counter with limits 7, 17 and 32, and the personal
   *   counters are ignored entirely while it is active.
   * CATCHES: both counters left live, so after a death the ghosts pour out at
   *   whichever threshold fires first. The re-entry after a death — the moment a
   *   player is most vulnerable — becomes far harsher than the original, and the
   *   personal-counter test above stays green throughout.
   * LOAD-BEARING: yes — the stub answers null, and three of these six
   *   expectations name a ghost.
   */
  it('ignores the personal counters entirely while the global counter is active', () => {
    const allPenned = pen(
      waiting(GhostId.Pinky, 999),
      waiting(GhostId.Inky, 999),
      waiting(GhostId.Clyde, 999),
    );

    expect(releaseDecision({ house: afterDeath(5), ghosts: allPenned, level: 1 })).toBeNull();
    expect(releaseDecision({ house: afterDeath(7), ghosts: allPenned, level: 1 })).toBe(
      GhostId.Pinky,
    );

    const pinkyOut = pen(
      outside(GhostId.Pinky),
      waiting(GhostId.Inky, 999),
      waiting(GhostId.Clyde, 999),
    );

    expect(releaseDecision({ house: afterDeath(16), ghosts: pinkyOut, level: 1 })).toBeNull();
    expect(releaseDecision({ house: afterDeath(17), ghosts: pinkyOut, level: 1 })).toBe(
      GhostId.Inky,
    );

    const clydeAlone = pen(
      outside(GhostId.Pinky),
      outside(GhostId.Inky),
      waiting(GhostId.Clyde, 999),
    );

    expect(releaseDecision({ house: afterDeath(31), ghosts: clydeAlone, level: 1 })).toBeNull();
    expect(releaseDecision({ house: afterDeath(32), ghosts: clydeAlone, level: 1 })).toBe(
      GhostId.Clyde,
    );
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: a timer rule stated in frames. A unit sets the counter to 239
   *   and then to 240; an integration test would have to hold Pac-Man still for
   *   four real seconds of simulation to reach the same assertion, and could not
   *   check the frame before.
   * MEASURES: both level bands, each on both sides of its boundary.
   *   Level 1 (240 frames), Pinky already out and Inky's 30-dot limit nowhere
   *   near met: nobody at 239, Inky at 240 — the earliest ghost in GHOST_ORDER
   *   still penned, not simply Pinky.
   *   Level 5 (180 frames), with the global counter active at 0 so that no
   *   counter can fire: nobody at 179, Pinky at 180.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.3 — four seconds on levels 1 to
   *   4 and three seconds from level 5, which section 1 converts to 240 and 180
   *   frames.
   * CATCHES: the rule omitted altogether, which is the usual outcome: every
   *   dot-counter test still passes, and a player who stops eating faces one
   *   ghost forever. It also catches the timeout hard-coded at 240 for every
   *   level, which makes level 5 onward a third slower to open than the arcade.
   * LOAD-BEARING: yes — the stub answers null, and two of these four
   *   expectations name a ghost.
   */
  it('releases the longest-waiting ghost after four seconds with no dot eaten, three from level 5', () => {
    const stalled = (frames: number): HouseState => ({
      globalCounter: 0,
      globalCounterActive: false,
      framesSinceDot: frames,
    });
    const inkyAndClydePenned = pen(
      outside(GhostId.Pinky),
      waiting(GhostId.Inky, 0),
      waiting(GhostId.Clyde, 0),
    );

    expect(
      releaseDecision({ house: stalled(239), ghosts: inkyAndClydePenned, level: 1 }),
    ).toBeNull();
    expect(releaseDecision({ house: stalled(240), ghosts: inkyAndClydePenned, level: 1 })).toBe(
      GhostId.Inky,
    );

    /* From level 3 on every personal limit is 0, so the level-5 case is run with
       the global counter active and empty — otherwise the personal counters
       would release a ghost first and the timer would prove nothing. */
    const stalledAfterDeath = (frames: number): HouseState => ({
      globalCounter: 0,
      globalCounterActive: true,
      framesSinceDot: frames,
    });
    const allPenned = pen(
      waiting(GhostId.Pinky, 0),
      waiting(GhostId.Inky, 0),
      waiting(GhostId.Clyde, 0),
    );

    expect(
      releaseDecision({ house: stalledAfterDeath(179), ghosts: allPenned, level: 5 }),
    ).toBeNull();
    expect(releaseDecision({ house: stalledAfterDeath(180), ghosts: allPenned, level: 5 })).toBe(
      GhostId.Pinky,
    );
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: a totality case with one obvious wrong answer. Cheap to state
   *   directly, and impossible to observe in a running game — a released ghost
   *   that was never in the house would just look like a ghost behaving oddly.
   * MEASURES: with all four ghosts out on the board and the stall timer far past
   *   any threshold, nobody is named; put one ghost back in the house and that
   *   ghost is named on the same inputs. The two halves are in one test on
   *   purpose: the "nobody" half alone would pass against a stub that always
   *   answers null, and would count as evidence while proving nothing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.4 — only phase InHouse is a
   *   candidate. A ghost in LeavingHouse is already walking out through the gate
   *   and must not be released a second time.
   * CATCHES: a release rule that consults only the counters and not the phase.
   *   Ghosts already hunting get "released" again every frame, which in slice
   *   s11 teleports them back to the house door mid-chase.
   * LOAD-BEARING: yes, thanks to the second half — the stub answers null and the
   *   second expectation names Clyde.
   */
  it('names nobody when the house is empty, and names the one ghost that is back in it', () => {
    const stalledLong: HouseState = {
      globalCounter: 0,
      globalCounterActive: false,
      framesSinceDot: 9_999,
    };

    expect(
      releaseDecision({
        house: stalledLong,
        ghosts: pen(outside(GhostId.Pinky), outside(GhostId.Inky), outside(GhostId.Clyde)),
        level: 1,
      }),
    ).toBeNull();

    expect(
      releaseDecision({
        house: stalledLong,
        ghosts: pen(
          outside(GhostId.Pinky),
          outside(GhostId.Inky),
          waiting(GhostId.Clyde, /* nowhere near the 60-dot limit */ 0),
        ),
        level: 1,
      }),
    ).toBe(GhostId.Clyde);
  });
});

describe('the house counters', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: two one-line state transitions. They exist as functions at
   *   all so that "a dot resets the stall timer" is written down once, next to
   *   the rule that reads it, instead of being an increment somewhere inside the
   *   eat system where nothing points at it.
   * MEASURES: `houseAfterFrame` ages the stall timer by one and touches nothing
   *   else; `houseAfterDot` resets it to zero and advances the global counter,
   *   but only while that counter is active. Whole records are compared, so a
   *   transition that also corrupted a neighbouring field would fail.
   * ORACLE: docs/ARCADE-REFERENCE.md section 12.3 — "the timer resets every time
   *   a dot is eaten" — and section 12.2, in which the global counter is the one
   *   the machine advances after a life is lost and is ignored before that.
   * CATCHES: the stall timer reset on every frame rather than on every dot, in
   *   which case it never reaches 240 and the four-second release above can
   *   never fire in a real game while its own unit test stays green. Also
   *   catches the global counter advancing before it has been switched on, which
   *   would release three ghosts instantly at the first death.
   * LOAD-BEARING: yes — the stub returns its argument unchanged, and all three
   *   expectations demand a changed field. The inactive case is given a stall
   *   timer of 137 for exactly that reason: it must not be able to pass by
   *   arriving at the value it was supposed to be reset to.
   */
  it('ages the stall timer each frame, and a dot resets it while advancing the global counter', () => {
    expect(
      houseAfterFrame({ globalCounter: 3, globalCounterActive: true, framesSinceDot: 11 }),
    ).toEqual({ globalCounter: 3, globalCounterActive: true, framesSinceDot: 12 });

    expect(
      houseAfterDot({ globalCounter: 3, globalCounterActive: true, framesSinceDot: 137 }),
    ).toEqual({ globalCounter: 4, globalCounterActive: true, framesSinceDot: 0 });

    expect(
      houseAfterDot({ globalCounter: 3, globalCounterActive: false, framesSinceDot: 137 }),
    ).toEqual({ globalCounter: 3, globalCounterActive: false, framesSinceDot: 0 });
  });
});
