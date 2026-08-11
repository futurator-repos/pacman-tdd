import { describe, expect, it } from 'vitest';

import { buildAtlas, validateSprite } from './atlas.ts';
import { type SpriteSource } from './sprite-source.ts';
import { ARCADE_PALETTE, GHOST_COLOURS, SPRITES, spriteNamed } from './sprites.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * transform.test.ts proves the derivation functions are correct. This file
 * proves they were actually USED to produce a complete, coherent sprite set.
 *
 * Those are different claims, and the second is the one the game depends on.
 * A correct `rotateClockwise` is no help if someone forgot to call it for
 * `pacman-up`, and the symptom would be Pac-Man silently facing the wrong way
 * when moving upward — a bug no logic test can see.
 */

const DIRECTIONS = ['right', 'down', 'left', 'up'] as const;
const GHOSTS = ['blinky', 'pinky', 'inky', 'clyde'] as const;

/**
 * Looks a sprite up and throws if it is absent.
 *
 * This exists because of a real defect found while writing these tests. The
 * comparison tests below were originally written with optional chaining:
 *
 *   expect(spriteNamed('pinky-right-1')?.pixels)
 *     .toEqual(spriteNamed('blinky-right-1')?.pixels);
 *
 * Against a stub where both lookups return `undefined`, that compares
 * `undefined` to `undefined` and PASSES — while checking nothing whatsoever.
 *
 * `?.` is a vacuous-test generator in assertions. Anywhere a test compares two
 * looked-up values, a missing value must be an error, not a silent `undefined`.
 */
function requireSprite(name: string): SpriteSource {
  const sprite = spriteNamed(name);
  if (sprite === undefined) {
    throw new Error(`No sprite named '${name}' in the roster`);
  }
  return sprite;
}

describe('the sprite roster', () => {
  /**
   * TYPE: unit (completeness check).
   * WHY THIS TYPE: the roster is data, so the cheapest possible test can assert
   * it. Discovering a missing sprite in an e2e run costs seconds and points at
   * a canvas, not at a name.
   *
   * MEASURES: that every sprite the renderer will ask for actually exists.
   *
   * ORACLE: the arcade's animation set — Pac-Man animates through open, half
   * and closed in each of four directions; each ghost has two frames per
   * direction; frightened ghosts flash white before the power pellet expires.
   *
   * CATCHES: a missing derivation. createCanvasSurface throws on an unknown
   * sprite name, so the game would crash mid-play the first time a ghost turned
   * a particular way — the worst possible time to find out.
   *
   * LOAD-BEARING: yes.
   */
  it('contains a Pac-Man frame for every direction and mouth position', () => {
    expect.assertions(DIRECTIONS.length * 2);
    for (const direction of DIRECTIONS) {
      for (const mouth of ['open', 'half']) {
        expect(spriteNamed(`pacman-${direction}-${mouth}`)).toBeDefined();
      }
    }
  });

  it('contains a closed Pac-Man, shared across directions', () => {
    /* A fully closed Pac-Man is a circle, so one sprite serves all four
       directions. Deriving four identical copies would waste atlas space and
       invite them to drift apart. */
    expect(spriteNamed('pacman-closed')).toBeDefined();
  });

  /**
   * TYPE: unit.
   * MEASURES: all 32 ghost frames exist.
   * ORACLE: four ghosts, four facings, two animation frames — the arcade set.
   * CATCHES: a recolour loop that skipped a ghost or a direction.
   * LOAD-BEARING: yes.
   */
  it('contains two animation frames for every ghost in every direction', () => {
    expect.assertions(GHOSTS.length * DIRECTIONS.length * 2);
    for (const ghost of GHOSTS) {
      for (const direction of DIRECTIONS) {
        for (const frame of [1, 2]) {
          expect(spriteNamed(`${ghost}-${direction}-${String(frame)}`)).toBeDefined();
        }
      }
    }
  });

  it('contains frightened and flashing ghost frames', () => {
    /* Frightened is blue; flashing is the white warning that the power pellet
       is about to expire. Without the flashing frames the player gets no
       warning, which changes how the game plays. */
    expect(spriteNamed('frightened-1')).toBeDefined();
    expect(spriteNamed('frightened-2')).toBeDefined();
    expect(spriteNamed('flashing-1')).toBeDefined();
    expect(spriteNamed('flashing-2')).toBeDefined();
  });

  it('contains eyes for every direction, for ghosts returning to the house', () => {
    expect.assertions(DIRECTIONS.length);
    for (const direction of DIRECTIONS) {
      expect(spriteNamed(`eyes-${direction}`)).toBeDefined();
    }
  });

  it('contains the pellet, power pellet and fruit', () => {
    expect(spriteNamed('pellet')).toBeDefined();
    expect(spriteNamed('power-pellet')).toBeDefined();
    expect(spriteNamed('cherry')).toBeDefined();
  });
});

describe('derivation is real, not duplication', () => {
  /**
   * TYPE: unit (structural).
   * WHY THIS TYPE: this asserts a RELATIONSHIP between two sprites, which no
   * visual test could state precisely and no e2e test could locate.
   *
   * MEASURES: that the four ghosts genuinely share one body shape.
   *
   * ORACLE: a stated design decision — all four arcade ghosts are the same
   * shape and differ only in colour.
   *
   * CATCHES: someone hand-authoring a second ghost body that drifts from the
   * first. The two would look subtly different in a way that is very hard to
   * see and impossible to attribute.
   *
   * LOAD-BEARING: yes.
   */
  it('gives all four ghosts identical pixel data', () => {
    expect.assertions(GHOSTS.length - 1);
    const reference = requireSprite('blinky-right-1');
    for (const ghost of GHOSTS.slice(1)) {
      expect(requireSprite(`${ghost}-right-1`).pixels).toEqual(reference.pixels);
    }
  });

  /**
   * TYPE: unit.
   * MEASURES: that sharing a shape did NOT mean sharing a colour.
   * ORACLE: the arcade ghost colours, already pinned in ARCADE_PALETTE.
   * CATCHES: the exact opposite failure to the test above — a recolour loop
   * that ran but passed the same colour every time, making four identical red
   * ghosts. Note that the previous test would still pass in that case, which is
   * precisely why this one has to exist alongside it.
   * LOAD-BEARING: yes.
   */
  it('gives each ghost its own arcade colour', () => {
    const bodyColours = GHOSTS.map((ghost) => requireSprite(`${ghost}-right-1`).palette['B']);

    expect(bodyColours).toEqual([
      ARCADE_PALETTE.BLINKY,
      ARCADE_PALETTE.PINKY,
      ARCADE_PALETTE.INKY,
      ARCADE_PALETTE.CLYDE,
    ]);
    expect(new Set(bodyColours).size).toBe(GHOSTS.length);
  });

  /**
   * TYPE: unit.
   * MEASURES: that left-facing Pac-Man really is the mirror of right-facing.
   * ORACLE: the definition of a horizontal mirror, applied to the shape we
   * authored.
   * CATCHES: pacman-left authored by hand and subtly asymmetric to
   * pacman-right, so his mouth opens by a different amount depending on travel
   * direction.
   * LOAD-BEARING: yes.
   */
  it('derives left-facing Pac-Man as the mirror of right-facing', () => {
    const right = requireSprite('pacman-right-open');
    const left = requireSprite('pacman-left-open');

    /* Reversed with an index loop rather than a string spread: eslint rightly
       forbids spreading strings, since it iterates code points. Pixel keys are
       single ASCII characters, but the rule is worth obeying rather than
       silencing. */
    const reversed = left.pixels.map((row) =>
      Array.from({ length: row.length }, (_unused, i) => row.charAt(row.length - 1 - i)).join(''),
    );

    expect(reversed).toEqual(right.pixels);
  });

  /**
   * TYPE: unit.
   * MEASURES: that GHOST_COLOURS drives the derivation, rather than the names
   * being typed twice.
   * ORACLE: design invariant — one list of ghosts, used everywhere.
   * CATCHES: adding a fifth ghost to the colour table and it silently not
   * appearing in the atlas.
   * LOAD-BEARING: yes.
   */
  it('derives exactly one ghost per entry in the colour table', () => {
    expect(Object.keys(GHOST_COLOURS)).toEqual([...GHOSTS]);
  });
});

describe('the roster as a whole', () => {
  /**
   * TYPE: unit.
   * MEASURES: every sprite passes validation.
   * ORACLE: the rules already pinned in atlas.test.ts — 16x16, rows of equal
   * width, every pixel key present in the palette.
   * CATCHES: a transform producing a malformed grid. Since transforms generate
   * over forty of these sprites, one bad transform corrupts most of the set.
   * LOAD-BEARING: no — a stub roster of one valid sprite passes. Guard.
   */
  it('is entirely valid', () => {
    expect.assertions(SPRITES.length);
    for (const sprite of SPRITES) {
      expect(() => {
        validateSprite(sprite);
      }).not.toThrow();
    }
  });

  /**
   * TYPE: unit.
   * MEASURES: no duplicate names.
   * ORACLE: buildAtlas rejects duplicates.
   * CATCHES: a derivation that forgot to pass a new name, so two sprites are
   * both called 'pacman-right-open' and one silently wins.
   * LOAD-BEARING: yes — deriving without renaming is the likeliest mistake here.
   */
  it('gives every sprite a unique name', () => {
    const names = SPRITES.map((sprite) => sprite.name);

    expect(new Set(names).size).toBe(names.length);
  });

  /**
   * TYPE: integration (asset pipeline end to end).
   * WHY THIS TYPE: the unit tests above check the roster's contents; this one
   * checks that the whole pipeline consumes it successfully. It is the cheapest
   * place to discover that fifty sprites together break something that one
   * sprite did not.
   *
   * MEASURES: the full roster compiles into an atlas with a frame for each.
   *
   * ORACLE: the atlas contract — one frame per sprite, dimensions consistent.
   *
   * CATCHES: an atlas that silently drops sprites, or an off-by-one in the
   * strip layout that only appears past a certain count.
   *
   * LOAD-BEARING: yes.
   */
  it('compiles into an atlas with a frame for every sprite', () => {
    const { manifest } = buildAtlas(SPRITES);

    expect(Object.keys(manifest.frames)).toHaveLength(SPRITES.length);
    expect(manifest.width).toBe(SPRITES.length * 16);
  });

  /**
   * TYPE: unit (regression guard on scale).
   * MEASURES: the roster is complete enough to run a real game.
   * ORACLE: 9 Pac-Man + 32 ghost + 4 frightened/flashing + 4 eyes + 3 items.
   * CATCHES: a silent shrink — if a future refactor drops a whole category,
   * every individual existence test above would still pass for the categories
   * that remain, but this total would move.
   * LOAD-BEARING: yes.
   */
  it('contains the full 52-sprite arcade set', () => {
    expect(SPRITES).toHaveLength(52);
  });
});
