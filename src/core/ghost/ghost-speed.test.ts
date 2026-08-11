import { describe, expect, it } from 'vitest';

import { Direction } from '../geometry/direction.ts';
import { TileKind } from '../maze/tile-kind.ts';
import { levelSpec } from '../rules/level-table.ts';

import { GhostId } from './ghost-id.ts';
import { ghostSpeed } from './ghost-speed.ts';
import { type Ghost, GhostPhase } from './ghost.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * A ghost has five possible speeds and only one of them is "the ghost speed".
 * Which one applies is a five-way SELECTION, and the interesting bugs are not in
 * the numbers — `level-table.test.ts` owns those — but in the PRECEDENCE between
 * them. A frightened ghost in the tunnel has two claims on its speed; so does an
 * Elroy Blinky who has just been frightened; so does a pair of eyes crossing the
 * tunnel on the way home.
 *
 * Every expectation below is written as a whole number of sub-pixels per frame,
 * with the arithmetic shown, rather than as `speedSubPixels(spec.ghostSpeed)`.
 * That is deliberate. Deriving the expectation with the same function the
 * implementation will use makes the assertion true by construction — the
 * tautology of docs/TDD-FINDINGS.md, failure mode 5. The chain a reader can
 * check by hand instead:
 *
 *   docs/ARCADE-REFERENCE.md section 2:  100% = 1.25 px/frame x 256 = 320 sub-pixels
 *   docs/ARCADE-REFERENCE.md section 3:  level 1 ghost = 75%  ->  0.75 x 320 = 240
 *
 * and the whole level-1 column, from section 11's table:
 *
 *   eyes        1.50  ->  480      tunnel   0.40  ->  128
 *   base        0.75  ->  240      fright   0.50  ->  160
 *   elroy 1     0.80  ->  256      elroy 2  0.85  ->  272
 */

/** Level 1. `levelSpec` is already implemented and pinned by its own suite. */
const LEVEL_1 = levelSpec(1);

/**
 * A ghost at rest, in the ordinary hunting state.
 *
 * The position is (0,0) and it means nothing: `ghostSpeed` receives the kind of
 * tile the ghost stands on as a `TileKind`, never a maze and never a position.
 * That is the module boundary — "which of five numbers" is a selection over a
 * record, and giving it a board would let it start asking the board questions.
 */
const HUNTING_BLINKY: Ghost = {
  id: GhostId.Blinky,
  actor: {
    position: { x: 0, y: 0 },
    facing: Direction.Left,
    queued: null,
    carrySubPixels: 0,
  },
  phase: GhostPhase.Hunting,
  frightenedFramesLeft: 0,
  dotCounter: 0,
  dotCounterActive: false,
  elroyStage: 0,
  reverseQueued: false,
};

describe('ghostSpeed', () => {
  /**
   * TYPE: unit
   * WHY THIS TYPE: pure selection over a record. Two calls pin that the number
   *   comes from the SPEC rather than from a constant in the module — which is
   *   the only way to tell a correct implementation from one that hard-codes 240
   *   and happens to be right on level 1.
   * MEASURES: an ordinary hunting ghost on open floor gets `spec.ghostSpeed`:
   *   240 sub-pixels at level 1 (0.75 x 320) and 304 at level 5 (0.95 x 320).
   * ORACLE: docs/ARCADE-REFERENCE.md section 3, the Ghost column — 75% at level
   *   1, 95% at level 5 — converted by section 2's FULL_SPEED of 320.
   * CATCHES: a module that ignores the LevelSpec it was handed. The ghosts stay
   *   at their level-1 speed for the whole game and the difficulty curve — the
   *   single thing the level table exists to provide — silently flattens.
   * LOAD-BEARING: yes — the stub returns 0.
   */
  it('gives an ordinary ghost the level spec ghost speed', () => {
    expect(ghostSpeed({ ghost: HUNTING_BLINKY, spec: LEVEL_1, tileKind: TileKind.Open })).toBe(240);

    expect(ghostSpeed({ ghost: HUNTING_BLINKY, spec: levelSpec(5), tileKind: TileKind.Open })).toBe(
      304,
    );
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: a precedence question has exactly two answers, and a unit can
   *   ask it directly by holding everything else fixed and flipping one field.
   * MEASURES: the tunnel row slows a ghost to `spec.ghostTunnelSpeed`, 128 at
   *   level 1 (0.40 x 320) — and the tunnel keeps that ghost at 128 against BOTH
   *   of the two rows below it in the table: a FRIGHTENED ghost is not given the
   *   160 its fright timer would buy it, and a CRUISE ELROY 2 Blinky is not given
   *   his 272. Both are needed. With only the fright case, a selection written as
   *   `if (elroy && !frightened) -> elroySpeed` before the tunnel row passes
   *   every other test in this file while running Elroy Blinky through the
   *   tunnel at 85%.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3 (tunnel 40% at level 1) and
   *   section 11.1: the table is read top to bottom, so the tunnel row — which
   *   sits above both Frightened and Cruise Elroy — wins over both.
   * CATCHES: fright or Elroy tested before the tunnel. A blue ghost crossing the
   *   tunnel runs 25% faster than the arcade's, an Elroy Blinky more than twice
   *   that, and the tunnel mouth — where a player corners a ghost — stops being
   *   the trap it is meant to be.
   * LOAD-BEARING: yes — the stub returns 0.
   */
  it('slows a ghost to the tunnel speed, and keeps it there when frightened or elroy', () => {
    expect(ghostSpeed({ ghost: HUNTING_BLINKY, spec: LEVEL_1, tileKind: TileKind.Tunnel })).toBe(
      128,
    );

    expect(
      ghostSpeed({
        ghost: { ...HUNTING_BLINKY, frightenedFramesLeft: 300 },
        spec: LEVEL_1,
        tileKind: TileKind.Tunnel,
      }),
    ).toBe(128);

    expect(
      ghostSpeed({
        ghost: { ...HUNTING_BLINKY, elroyStage: 2 },
        spec: LEVEL_1,
        tileKind: TileKind.Tunnel,
      }),
    ).toBe(128);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: one field, one number. The frightened speed is what makes a
   *   power pellet worth eating, so it is asserted on its own rather than
   *   inferred from the ordering test at the end.
   * MEASURES: a ghost with frames left on its fright timer, on open floor, moves
   *   at `spec.ghostFrightSpeed` — 160 at level 1 (0.50 x 320) — and a Blinky at
   *   Cruise Elroy stage 2 who is ALSO frightened moves at the same 160 rather
   *   than at his Elroy 272.
   * ORACLE: docs/ARCADE-REFERENCE.md section 3 (ghost fright 50% at level 1) and
   *   section 11.1: fright beats Cruise Elroy, because a frightened Blinky is a
   *   frightened ghost first — blue, edible and slow.
   * CATCHES: Elroy tested before fright. Late in a level, the one ghost a power
   *   pellet exists to save you from stays faster than Pac-Man while blue, and
   *   the pellet stops working exactly when it matters most.
   * LOAD-BEARING: yes — the stub returns 0.
   */
  it('slows a frightened ghost, and a frightened cruise-elroy blinky with it', () => {
    expect(
      ghostSpeed({
        ghost: { ...HUNTING_BLINKY, frightenedFramesLeft: 1 },
        spec: LEVEL_1,
        tileKind: TileKind.Open,
      }),
    ).toBe(160);

    expect(
      ghostSpeed({
        ghost: { ...HUNTING_BLINKY, frightenedFramesLeft: 300, elroyStage: 2 },
        spec: LEVEL_1,
        tileKind: TileKind.Open,
      }),
    ).toBe(160);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: the eyes speed is the one number in this module that is OURS
   *   rather than the arcade's, so it gets its own named test whose oracle line
   *   says so out loud.
   * MEASURES: a ghost in phase Eyes moves at 480 sub-pixels (1.5 x 320) on open
   *   floor, in the tunnel, and while the fright timer is still running — three
   *   calls, because "eyes beat everything" is a claim about precedence and one
   *   call cannot make it.
   * ORACLE: docs/ARCADE-REFERENCE.md section 11.2 — [repo convention]. Table A.1
   *   publishes no eyes speed; 1.5 is chosen so that eyes are strictly faster
   *   than every living actor at every level (the fastest fraction anywhere else
   *   is Cruise Elroy 2 at 1.05). A test asserting 480 is asserting that
   *   paragraph, not the ROM, and it should be read that way.
   * CATCHES: eyes subject to the tunnel slowdown. A ghost eaten near a tunnel
   *   mouth crawls home at 128 and is missing for most of the fright period, so
   *   the four-ghost chain a skilled player sets up becomes impossible — with
   *   nothing to see except ghosts that "feel slow".
   * LOAD-BEARING: yes — the stub returns 0.
   */
  it('sends eyes home fastest of all, unslowed by the tunnel or by fright', () => {
    const eyes: Ghost = { ...HUNTING_BLINKY, phase: GhostPhase.Eyes };

    expect(ghostSpeed({ ghost: eyes, spec: LEVEL_1, tileKind: TileKind.Open })).toBe(480);
    expect(ghostSpeed({ ghost: eyes, spec: LEVEL_1, tileKind: TileKind.Tunnel })).toBe(480);
    expect(
      ghostSpeed({
        ghost: { ...eyes, frightenedFramesLeft: 120 },
        spec: LEVEL_1,
        tileKind: TileKind.Open,
      }),
    ).toBe(480);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: two stages, two numbers, one field. A unit asks for both
   *   directly; an integration test would have to eat 220 dots to see the first
   *   one.
   * MEASURES: Blinky at `elroyStage` 1 moves at `spec.elroy1Speed` — 256 at
   *   level 1 (0.80 x 320), which is faster than the other ghosts' 240 — and at
   *   stage 2 he moves at `spec.elroy2Speed`, 272 (0.85 x 320).
   * ORACLE: docs/ARCADE-REFERENCE.md section 5 and the section 3 table: Blinky
   *   speeds up twice per level, to 80% and then 85% at level 1, while the other
   *   ghosts stay at 75%.
   * CATCHES: the Elroy row never read. Blinky stops accelerating as the board
   *   empties, which removes the entire late-level difficulty ramp — the game
   *   still plays, and gets easier and easier, and no other test notices.
   *   WHICH GHOST is checked is left to `elroy.ts`: this module reads the stage
   *   field it is given, and the stage field is only ever non-zero for Blinky.
   * LOAD-BEARING: yes — the stub returns 0.
   */
  it("reads blinky's cruise elroy stage from the level spec", () => {
    expect(
      ghostSpeed({
        ghost: { ...HUNTING_BLINKY, elroyStage: 1 },
        spec: LEVEL_1,
        tileKind: TileKind.Open,
      }),
    ).toBe(256);

    expect(
      ghostSpeed({
        ghost: { ...HUNTING_BLINKY, elroyStage: 2 },
        spec: LEVEL_1,
        tileKind: TileKind.Open,
      }),
    ).toBe(272);
  });

  /**
   * TYPE: unit
   * WHY THIS TYPE: the four tests above each pin one number; this one pins the
   *   RELATIONSHIP between them, which is the part a reader can sanity-check
   *   against the game they remember playing. It is one assertion over four
   *   values rather than four separate comparisons, so a single failure prints
   *   the whole picture.
   * MEASURES: at level 1, eyes (480) > base (240) > fright (160) > tunnel (128),
   *   asserted as an ordered array so the message shows all four.
   * ORACLE: docs/ARCADE-REFERENCE.md section 11's table, level-1 column. Ghosts
   *   crawl in the tunnel, slow down when frightened, and return home as eyes
   *   faster than they ever move alive.
   * CATCHES: any two rows swapped in the selection — fright given the tunnel's
   *   number, or eyes given the base speed. Each of those passes exactly one of
   *   the tests above and fails here, which is the point of stating the ordering
   *   separately.
   * LOAD-BEARING: yes — the stub returns 0 for all four, so the array is
   *   [0, 0, 0, 0] and no ordering holds.
   */
  it('orders the level-1 speeds eyes, base, frightened, tunnel — fastest to slowest', () => {
    const speeds = [
      ghostSpeed({
        ghost: { ...HUNTING_BLINKY, phase: GhostPhase.Eyes },
        spec: LEVEL_1,
        tileKind: TileKind.Open,
      }),
      ghostSpeed({ ghost: HUNTING_BLINKY, spec: LEVEL_1, tileKind: TileKind.Open }),
      ghostSpeed({
        ghost: { ...HUNTING_BLINKY, frightenedFramesLeft: 300 },
        spec: LEVEL_1,
        tileKind: TileKind.Open,
      }),
      ghostSpeed({ ghost: HUNTING_BLINKY, spec: LEVEL_1, tileKind: TileKind.Tunnel }),
    ];

    expect(speeds).toEqual([480, 240, 160, 128]);
  });
});
