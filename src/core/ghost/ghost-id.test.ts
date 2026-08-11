import { describe, expect, it } from 'vitest';

import { GHOST_ORDER, GhostId } from './ghost-id.ts';

/**
 * The four ghosts, and the one order four different subsystems agree on.
 *
 * There is nothing to compute here, which is exactly why it deserves a test:
 * `GHOST_ORDER` is a four-element array that looks like a formatting detail and
 * is in fact a determinism contract.
 */
describe('GhostId', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: A four-element frozen array is a value; comparing it to a
   *   literal is the cheapest possible check and there is no cooperation
   *   between modules to observe, so nothing more expensive would add anything.
   * MEASURES: The exact identity AND the exact sequence of GHOST_ORDER.
   * ORACLE: The arcade's ghost roster and its fixed release order — Blinky
   *   starts outside the house, Pinky leaves first at 0 dots, then Inky at 30,
   *   then Clyde at 60 (docs/ARCADE-REFERENCE.md, level 1 house-release table).
   *   The same order is the arcade's collision-check order and its draw order.
   *   The string ids are the names the ROM's own sprite table uses.
   * CATCHES: Someone alphabetises the array (blinky, clyde, inky, pinky) or
   *   builds it from Object.values() of a record whose key order later shifts.
   *   Nothing would look wrong: four ghosts still spawn, still chase, still get
   *   eaten. But Clyde would leave the house second, the Rng stream would be
   *   consumed in a different sequence, and every committed replay fixture
   *   would stop reproducing — a bug whose symptom appears nowhere near here.
   * LOAD-BEARING: yes — GHOST_ORDER is stubbed to [].
   */
  it('is ordered blinky, pinky, inky, clyde — release, collision, Rng and draw order all at once', () => {
    expect(GHOST_ORDER).toEqual(['blinky', 'pinky', 'inky', 'clyde']);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: A completeness claim over a four-element array. Unit is the
   *   only sensible cost; a property test over four fixed values would generate
   *   nothing the literal list does not already state.
   * MEASURES: That every GhostId appears in GHOST_ORDER exactly once — no ghost
   *   missing, no ghost listed twice.
   * ORACLE: The arcade has exactly four ghosts, and each one is released,
   *   collided, drawn and given an Rng draw exactly once per frame.
   * CATCHES: A copy-paste that lists Pinky twice and drops Inky. Inky would
   *   never leave the house and never be drawn, and because he also never
   *   consumes his Rng draw, Clyde would silently inherit Inky's frightened
   *   turns. The previous test would still pass if the duplication were, say,
   *   appended as a fifth entry — this one would not.
   * LOAD-BEARING: yes — the loop is over the four GhostId literals, so it runs
   *   whatever GHOST_ORDER contains, and each filter finds 0 entries in the
   *   empty stub instead of 1. The expect.assertions(4) is belt and braces
   *   against the vacuous pass of docs/TDD-FINDINGS.md: it is what would fire
   *   if this loop were ever rewritten to iterate GHOST_ORDER itself, which is
   *   the shape that silently checks nothing.
   */
  it('lists each of the four ghosts exactly once', () => {
    expect.assertions(4);
    for (const id of [GhostId.Blinky, GhostId.Pinky, GhostId.Inky, GhostId.Clyde]) {
      expect(GHOST_ORDER.filter((entry) => entry === id)).toHaveLength(1);
    }
  });
});
