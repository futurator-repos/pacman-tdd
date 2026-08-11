import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ALL_DIRECTIONS, Direction } from '../geometry/direction.ts';
import { createScriptedRng } from '../testing/scripted-rng.ts';

import { chooseFrightenedDirection } from './frightened-turn.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * A power pellet switches every ghost from "hunt" to "flee", and fleeing has no
 * target at all: the ghost picks pseudo-randomly among its legal exits. That is
 * the one place in the whole game where the rules consult a random number, and
 * it is therefore the one place a replay can silently desynchronise.
 *
 * Two things are being pinned here, and only one of them is about Pac-Man:
 *
 *   1. THE TURN — the draw selects an index into the legal exits.
 *   2. THE DRAW COUNT — exactly one per decision. This is a contract of
 *      `src/core/game/replay.ts`, not of the arcade. A seeded stream replayed
 *      from a seed and an input log reproduces a game only if the number of
 *      draws matches; an extra draw for a rejected candidate shifts every
 *      later ghost turn in the run.
 *
 * ---------------------------------------------------------------------------
 * WHY createScriptedRng AND NOT createRng WITH A SEED
 *
 * `createRng(1234)` would make the test deterministic but not READABLE: the
 * expected direction would be whatever mulberry32's first output happens to
 * index, which is a fact about the generator rather than about the rule — the
 * tautological expectation of docs/TDD-FINDINGS.md, failure mode 5. A script of
 * literal draws states the input in the test, so a reader can do the arithmetic.
 *
 * The script also throws when it runs out, which is what turns "consumes
 * exactly one draw" from a hope into an assertion. No spies, no mocks.
 * ---------------------------------------------------------------------------
 */

/** A four-way junction's exits, in the ALL_DIRECTIONS order the caller supplies. */
const FOUR_EXITS: readonly Direction[] = [
  Direction.Up,
  Direction.Left,
  Direction.Down,
  Direction.Right,
];

describe('chooseFrightenedDirection', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: the mapping from a draw to a direction is arithmetic over an
   *   array. A unit states the four draws and the four answers side by side; a
   *   test that ran a frightened ghost through the game would assert the same
   *   arithmetic through two other modules and a frame counter.
   * MEASURES: `rng.nextInt(4)` is `Math.floor(draw * 4)`, so with four exits:
   *     0.00 -> 0 -> up      0.26 -> 1 -> left
   *     0.50 -> 2 -> down    0.99 -> 3 -> right
   *   Asserted as one array so that the loop that produces the route contains no
   *   assertion of its own and cannot pass vacuously.
   * ORACLE: docs/ARCADE-REFERENCE.md section 10, "Frightened turns" — the draw
   *   indexes the already-legal exits, which arrive in ALL_DIRECTIONS order
   *   because that is what `walkableNeighbours` returns.
   * CATCHES: an off-by-one in the index (`nextInt(length + 1)`, or `Math.round`
   *   instead of `Math.floor`), which returns `undefined` on the boundary draw —
   *   a crash roughly one decision in a hundred, in the middle of a fright.
   * LOAD-BEARING: yes — the stub returns right four times over and takes no
   *   draws at all.
   */
  it('turns the draw into an index over the legal exits, in order', () => {
    const rng = createScriptedRng([0, 0.26, 0.5, 0.99]);

    const route = [0, 1, 2, 3].map(() => chooseFrightenedDirection(rng, FOUR_EXITS));

    expect(route).toEqual([Direction.Up, Direction.Left, Direction.Down, Direction.Right]);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: draw COUNT is not observable in a return value, only in the
   *   state of the generator afterwards. A scripted Rng that throws on
   *   exhaustion makes it observable without a spy — and a spy would be asserting
   *   on the implementation rather than on the behaviour.
   * MEASURES: with a script of exactly one value, the first decision succeeds
   *   and consumes it, and the second throws "script exhausted". Both halves are
   *   needed: the first would fail if the function drew twice (the script would
   *   already be empty), the second would fail if it drew nothing.
   * ORACLE: docs/ARCADE-REFERENCE.md section 10 — exactly one draw per decision,
   *   because `replay.ts` reproduces a game from a seed plus an input log and
   *   can only do so if the stream is consumed identically.
   * CATCHES: a draw taken every FRAME rather than every decision, or a second
   *   draw for a rejected candidate. Every committed replay fixture
   *   desynchronises the moment a power pellet is eaten, and the bug report
   *   reads "the replay is wrong sometimes".
   * LOAD-BEARING: yes — the stub returns right (the first expectation is down)
   *   and never exhausts the script (the second expectation is a throw).
   */
  it('consumes exactly one draw per decision', () => {
    const rng = createScriptedRng([0.5]);

    expect(chooseFrightenedDirection(rng, FOUR_EXITS)).toBe(Direction.Down);
    expect(() => chooseFrightenedDirection(rng, FOUR_EXITS)).toThrow(/exhausted/);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: determinism is a claim about two runs, so it needs two runs
   *   and nothing else. Cheapest possible statement of the replay contract.
   * MEASURES: two generators built from the same script produce the same
   *   sequence of six turns over a changing set of exits.
   * ORACLE: this repository's replay contract (docs/ARCHITECTURE.md, "GameInput
   *   and Replay"): the same seed and the same inputs reproduce a game exactly.
   *   Not an arcade fact, and labelled as such.
   * CATCHES: a rule that reached for `Math.random()` — though eslint bans it in
   *   `src/core/**` — or one that mixed a second, unseeded source into the
   *   choice.
   * LOAD-BEARING: NO. This is a guard, in the exact sense of
   *   docs/TDD-FINDINGS.md, "the stub is a measuring instrument": a constant
   *   function is perfectly deterministic, so the do-nothing stub passes it.
   *   It is kept because it states the contract, and it is labelled because a
   *   test that pins nothing should say so rather than be counted as evidence.
   *   The load-bearing half of this contract is the draw-count test above.
   */
  it('produces the same route twice from the same script', () => {
    const script = [0.1, 0.9, 0.4, 0.6, 0.05, 0.75];
    const exits: readonly (readonly Direction[])[] = [
      FOUR_EXITS,
      [Direction.Up, Direction.Down],
      [Direction.Left, Direction.Down, Direction.Right],
      FOUR_EXITS,
      [Direction.Up, Direction.Right],
      FOUR_EXITS,
    ];

    const run = (): readonly Direction[] => {
      const rng = createScriptedRng(script);
      return exits.map((legal) => chooseFrightenedDirection(rng, legal));
    };

    expect(run()).toEqual(run());
  });

  /**
   * TYPE: property
   * WHY THIS TYPE: randomness is exactly where example-based coverage is
   *   weakest. One scripted value exercises one branch of the index arithmetic;
   *   the interesting values are the ones at the ends, and the interesting exit
   *   lists are the short ones. fast-check covers both and shrinks a failure to
   *   the smallest draw and the shortest list that break it.
   * MEASURES: for any draw in [0, 1) and any non-empty subset of the four
   *   directions — including the single-element list a dead end produces — the
   *   returned direction is a member of that list.
   * ORACLE: docs/ARCADE-REFERENCE.md section 10 — a frightened ghost still obeys
   *   the walls; only its preference becomes random. A direction outside `legal`
   *   is a ghost walking through a wall.
   * CATCHES: the boundary draw mapping one index past the end (`undefined` under
   *   noUncheckedIndexedAccess), and any implementation that ignores the list it
   *   was handed and consults something else.
   * LOAD-BEARING: yes — the stub returns right, and fast-check will generate a
   *   legal list without right in it within a handful of runs.
   * NOTE ON VACUITY: `checks` counts the executions of the property body and is
   *   asserted afterwards, so a generator that produced nothing could not report
   *   success — docs/TDD-FINDINGS.md, failure mode 2.
   */
  it('only ever returns a direction from the legal list it was given', () => {
    const runs = 200;
    let checks = 0;

    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
        fc.subarray([...ALL_DIRECTIONS], { minLength: 1 }),
        (draw, legal) => {
          const rng = createScriptedRng([draw]);

          expect(legal).toContain(chooseFrightenedDirection(rng, legal));

          checks += 1;
        },
      ),
      { numRuns: runs },
    );

    expect(checks).toBeGreaterThanOrEqual(runs);
  });
});
