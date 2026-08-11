import { describe, expect, it } from 'vitest';

import { type SpriteSource, SPRITE_SIZE } from './sprite-source.ts';
import { mirrorHorizontal, recolour, rotateClockwise } from './transform.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * A full Pac-Man needs roughly 52 sprites: Pac-Man in four directions, four
 * ghosts in four directions with two animation frames each, frightened frames,
 * eyes, pellets and fruit. Hand-authoring 52 grids of 16x16 pixels would be
 * about 800 lines of art data that nobody could review.
 *
 * A studio would not do that. It would author a handful of base shapes and
 * derive the rest — rotate the right-facing Pac-Man to get the other three
 * directions, recolour one ghost body to get the other three ghosts.
 *
 * That turns an art problem into three pure functions, which is exactly the
 * kind of thing tests are good at. These transforms are the highest-leverage
 * code in the asset pipeline: a bug in `rotateClockwise` corrupts 40 sprites at
 * once, and it would show up on screen as "the ghosts look wrong when moving
 * up" — a description nobody can debug from.
 */

/** A tiny asymmetric sprite. Asymmetry is the point: a symmetric fixture would
 *  pass even if rotation were implemented as "return the input unchanged". */
const marker: SpriteSource = {
  name: 'marker',
  /* Deliberately distinct from any colour used as a recolour target below.
     An earlier version of this fixture used #00ff00 here AND recoloured to
     #00ff00, so "leaves other entries untouched" passed partly by coincidence. */
  palette: { _: null, A: '#ff0000', B: '#0000ff' },
  pixels: [
    'AB______________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
  ],
};

describe('rotateClockwise', () => {
  /**
   * TYPE: unit.
   * WHY THIS TYPE: this is a pure function over a small data structure. A unit
   * test runs in under a millisecond and points at the exact broken function.
   * Nothing slower could tell us more.
   *
   * MEASURES: that the pixel at the top-left ends up at the top-right, which is
   * what a 90-degree clockwise turn means.
   *
   * ORACLE: the mathematical definition of rotation, not our implementation.
   * For an N-wide grid, new[r][c] = old[N-1-c][r].
   *
   * CATCHES: rotating the wrong way. An anticlockwise rotation would put 'A' at
   * the bottom-left instead, and every ghost would face backwards.
   *
   * LOAD-BEARING: yes — fails against a stub that returns its input.
   */
  it('moves the top-left pixel to the top-right', () => {
    const rotated = rotateClockwise(marker);

    expect(rotated.pixels[0]?.charAt(SPRITE_SIZE - 1)).toBe('A');
  });

  /**
   * TYPE: unit.
   * MEASURES: that the pixel to the RIGHT of the corner ends up BELOW the
   * corner — pinning the direction of travel around the grid, which the
   * previous test alone does not.
   *
   * ORACLE: same rotation definition. 'B' starts at (row 0, col 1) and a
   * clockwise turn sends it to (row 1, col 15).
   *
   * CATCHES: a transpose implemented instead of a rotation. A transpose would
   * also move 'A' correctly, so without this test a mirrored-diagonal bug ships.
   *
   * LOAD-BEARING: yes.
   */
  it('moves the pixel right of the corner to below the corner', () => {
    const rotated = rotateClockwise(marker);

    expect(rotated.pixels[1]?.charAt(SPRITE_SIZE - 1)).toBe('B');
  });

  /**
   * TYPE: property (an invariant over all inputs, checked here on a real sprite).
   * WHY THIS TYPE: "four quarter turns is the identity" is a statement about
   * every possible sprite, not about one example. It is the single strongest
   * statement we can make about a rotation, and it holds no matter what the art
   * looks like.
   *
   * MEASURES: that rotation loses nothing and drifts nothing.
   *
   * ORACLE: the group structure of rotations — four 90-degree turns are a
   * complete revolution. This is a fact about geometry, not about our code.
   *
   * CATCHES: off-by-one indexing that shifts the image by a pixel each turn.
   * Such a bug is nearly invisible on a single rotation and obvious after four.
   *
   * LOAD-BEARING: NO — a stub returning its input passes this trivially.
   * Kept anyway, because it is the test most likely to catch a subtle
   * regression later. It is a guard, not a specification.
   */
  it('returns to the original after four quarter turns', () => {
    const round = rotateClockwise(rotateClockwise(rotateClockwise(rotateClockwise(marker))));

    expect(round.pixels).toEqual(marker.pixels);
  });

  /**
   * TYPE: unit.
   * MEASURES: that the output is still a valid sprite shape.
   * ORACLE: SPRITE_SIZE is fixed at 16 by the arcade hardware.
   * CATCHES: a rotation that produces ragged rows, which would then fail
   * validation far away from here with a confusing message.
   * LOAD-BEARING: no — a stub returns a correctly-sized sprite too. Guard.
   */
  it('preserves the 16x16 shape', () => {
    const rotated = rotateClockwise(marker);

    expect(rotated.pixels).toHaveLength(SPRITE_SIZE);
    for (const row of rotated.pixels) {
      expect(row).toHaveLength(SPRITE_SIZE);
    }
  });

  /**
   * TYPE: unit.
   * MEASURES: that the source sprite is untouched.
   * ORACLE: a stated design invariant — these transforms are pure, because the
   * same base sprite is rotated four separate times to build four directions.
   * CATCHES: in-place mutation. If rotate mutated its input, building
   * up/down/left from one base would compound the rotations and produce three
   * wrong sprites. That is a genuinely confusing bug to track down.
   *
   * LOAD-BEARING: no — and this prediction was originally wrong, which is worth
   * recording. A stub that returns its input unchanged is trivially pure, so
   * every "does not mutate" test passes against it.
   *
   * The general rule this reveals: a test of a NEGATIVE property ("does not X")
   * can never be load-bearing against a do-nothing stub, because a stub does
   * nothing — including X. Such tests are guards. They earn their place the
   * moment a real implementation exists that COULD mutate, and here that is a
   * live risk, since the obvious way to write a rotation is to write into the
   * array you were handed.
   */
  it('does not mutate its input', () => {
    const before = structuredClone(marker);

    rotateClockwise(marker);

    expect(marker).toEqual(before);
  });

  /**
   * TYPE: unit.
   * MEASURES: that a derived sprite gets its own identity in the atlas.
   * ORACLE: buildAtlas() rejects duplicate names — a rule already pinned by a
   * test in atlas.test.ts.
   * CATCHES: four rotations all called 'pacman', which would make the atlas
   * builder throw with no clue about which transform caused it.
   * LOAD-BEARING: yes.
   */
  it('takes a new name for the derived sprite', () => {
    const rotated = rotateClockwise(marker, 'marker-down');

    expect(rotated.name).toBe('marker-down');
  });
});

describe('mirrorHorizontal', () => {
  /**
   * TYPE: unit.
   * WHY THIS TYPE: pure function, exact expected value.
   *
   * MEASURES: that columns are reversed.
   *
   * ORACLE: the definition of a horizontal mirror: new[r][c] = old[r][N-1-c].
   *
   * CATCHES: a vertical flip implemented by mistake. Pac-Man facing left is
   * produced by mirroring the right-facing sprite; a vertical flip would leave
   * him facing right but upside down, which on a symmetric-ish circle is
   * genuinely easy to miss by eye.
   *
   * LOAD-BEARING: yes.
   */
  it('reverses each row', () => {
    const mirrored = mirrorHorizontal(marker);

    expect(mirrored.pixels[0]?.charAt(SPRITE_SIZE - 1)).toBe('A');
    expect(mirrored.pixels[0]?.charAt(SPRITE_SIZE - 2)).toBe('B');
  });

  /**
   * TYPE: property.
   * MEASURES: mirroring twice is the identity.
   * ORACLE: a mirror is an involution — a fact about the operation itself.
   * CATCHES: off-by-one column indexing, which shifts the sprite one pixel left
   * on every mirror.
   * LOAD-BEARING: no. Guard.
   */
  it('returns to the original when applied twice', () => {
    expect(mirrorHorizontal(mirrorHorizontal(marker)).pixels).toEqual(marker.pixels);
  });

  /**
   * TYPE: unit. Same purity reasoning as rotation.
   * LOAD-BEARING: no — a negative property, see the note on rotation above. Guard.
   */
  it('does not mutate its input', () => {
    const before = structuredClone(marker);

    mirrorHorizontal(marker);

    expect(marker).toEqual(before);
  });
});

describe('recolour', () => {
  /**
   * TYPE: unit.
   * WHY THIS TYPE: the whole point of recolour is a small, exact mapping.
   *
   * MEASURES: that the named palette entry takes the new colour.
   *
   * ORACLE: the arcade's ghost colours. All four ghosts share one body shape
   * and differ only in colour — Blinky #FF0000, Pinky #FFB8FF, Inky #00FFFF,
   * Clyde #FFB852.
   *
   * CATCHES: the entire ghost roster rendering in one colour, which would make
   * the game unplayable in a way no gameplay assertion would notice.
   *
   * LOAD-BEARING: yes.
   */
  it('replaces the colour of a palette entry', () => {
    const green = recolour(marker, 'marker-green', { A: '#00ff00' });

    expect(green.palette['A']).toBe('#00ff00');
  });

  /**
   * TYPE: unit.
   * MEASURES: that untouched entries survive.
   * ORACLE: design invariant — a ghost recolour changes the body but must leave
   * the white of the eyes and the blue of the pupils alone.
   * CATCHES: a recolour that replaces the whole palette instead of merging,
   * which would make every ghost's eyes vanish.
   * LOAD-BEARING: no, as it turns out. A stub returning its input keeps every
   * other entry intact by definition. It still catches a whole-palette
   * replacement once a real implementation exists, so it is a useful guard —
   * but it specifies nothing on its own.
   */
  it('leaves other palette entries untouched', () => {
    const green = recolour(marker, 'marker-green', { A: '#00ff00' });

    expect(green.palette['B']).toBe('#0000ff');
    expect(green.palette['_']).toBeNull();
  });

  /**
   * TYPE: unit.
   * MEASURES: that pixel data is shared unchanged — only colour differs.
   * ORACLE: design invariant — recolour is a palette operation, not a drawing
   * operation.
   * CATCHES: a recolour that also rewrites pixel keys, silently changing shape.
   * LOAD-BEARING: no — a stub returning the input keeps pixels identical too.
   * Guard.
   */
  it('does not change the pixels', () => {
    const green = recolour(marker, 'marker-green', { A: '#00ff00' });

    expect(green.pixels).toEqual(marker.pixels);
  });

  /**
   * TYPE: unit (error path).
   * WHY THIS TYPE: error behaviour is behaviour, and it is cheapest to pin here.
   *
   * MEASURES: that recolouring a key that does not exist is rejected.
   *
   * ORACLE: a stated design decision — silently adding an unused palette entry
   * would mean a typo like `{ Bo: ... }` instead of `{ B: ... }` produces a
   * sprite that is simply the wrong colour, with no error anywhere.
   *
   * CATCHES: exactly that typo. This is the single most likely mistake when
   * defining four ghost variants by hand.
   *
   * LOAD-BEARING: yes — a stub that never throws fails this.
   */
  it('rejects recolouring a key that is not in the palette', () => {
    expect(() => recolour(marker, 'oops', { Z: '#ffffff' })).toThrow(/'Z'/);
  });

  /**
   * TYPE: unit. Purity, as above.
   * LOAD-BEARING: no — a negative property, see the note on rotation above. Guard.
   */
  it('does not mutate its input', () => {
    const before = structuredClone(marker);

    recolour(marker, 'marker-green', { A: '#00ff00' });

    expect(marker).toEqual(before);
  });
});
