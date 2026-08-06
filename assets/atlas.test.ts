import { describe, expect, it } from 'vitest';

import { buildAtlas, validateSprite } from './atlas.ts';
import { SPRITE_SIZE, type SpriteSource } from './sprite-source.ts';
import { ARCADE_PALETTE, SPRITES } from './sprites.ts';

const validSprite = (overrides: Partial<SpriteSource> = {}): SpriteSource => ({
  name: 'test',
  palette: { _: null, Y: '#ffff00' },
  pixels: Array.from({ length: SPRITE_SIZE }, () => 'Y'.repeat(SPRITE_SIZE)),
  ...overrides,
});

describe('validateSprite', () => {
  it('accepts a well-formed 16x16 sprite', () => {
    expect(() => {
      validateSprite(validSprite());
    }).not.toThrow();
  });

  it('rejects a sprite with the wrong number of rows', () => {
    const sprite = validSprite({ pixels: ['YYYY'] });
    expect(() => {
      validateSprite(sprite);
    }).toThrow(/16 rows/i);
  });

  it('rejects a row of the wrong width', () => {
    const rows = Array.from({ length: SPRITE_SIZE }, () => 'Y'.repeat(SPRITE_SIZE));
    rows[3] = 'YY';
    const sprite = validSprite({ pixels: rows });
    expect(() => {
      validateSprite(sprite);
    }).toThrow(/row 3/i);
  });

  it('rejects a pixel character that is missing from the palette', () => {
    const rows = Array.from({ length: SPRITE_SIZE }, () => 'Y'.repeat(SPRITE_SIZE));
    rows[5] = `Q${'Y'.repeat(SPRITE_SIZE - 1)}`;
    const sprite = validSprite({ pixels: rows });
    /* Without this check a typo silently renders as a transparent hole,
       which is very hard to spot and impossible to attribute later. */
    expect(() => {
      validateSprite(sprite);
    }).toThrow(/'Q'/);
  });
});

describe('buildAtlas', () => {
  it('places every sprite in the manifest', () => {
    const { manifest } = buildAtlas([validSprite({ name: 'a' }), validSprite({ name: 'b' })]);
    expect(Object.keys(manifest.frames).sort()).toEqual(['a', 'b']);
  });

  it('lays sprites out left to right without overlapping', () => {
    const { manifest } = buildAtlas([validSprite({ name: 'a' }), validSprite({ name: 'b' })]);
    expect(manifest.frames['a']).toEqual({ x: 0, y: 0, w: SPRITE_SIZE, h: SPRITE_SIZE });
    expect(manifest.frames['b']).toEqual({ x: SPRITE_SIZE, y: 0, w: SPRITE_SIZE, h: SPRITE_SIZE });
  });

  it('reports an atlas wide enough to hold every sprite', () => {
    const { manifest } = buildAtlas([
      validSprite({ name: 'a' }),
      validSprite({ name: 'b' }),
      validSprite({ name: 'c' }),
    ]);
    expect(manifest.width).toBe(3 * SPRITE_SIZE);
    expect(manifest.height).toBe(SPRITE_SIZE);
  });

  it('produces RGBA pixel data sized to the atlas', () => {
    const { rgba, manifest } = buildAtlas([validSprite()]);
    expect(rgba.length).toBe(manifest.width * manifest.height * 4);
  });

  it('writes an opaque pixel where the palette gives a colour', () => {
    const { rgba } = buildAtlas([validSprite()]);
    /* Top-left pixel is 'Y' -> #ffff00, fully opaque. */
    expect([rgba[0], rgba[1], rgba[2], rgba[3]]).toEqual([0xff, 0xff, 0x00, 0xff]);
  });

  it('writes a fully transparent pixel where the palette gives null', () => {
    const rows = Array.from({ length: SPRITE_SIZE }, () => '_'.repeat(SPRITE_SIZE));
    const { rgba } = buildAtlas([validSprite({ pixels: rows })]);
    expect(rgba[3]).toBe(0);
  });

  it('rejects two sprites sharing a name, rather than silently dropping one', () => {
    expect(() => buildAtlas([validSprite({ name: 'dup' }), validSprite({ name: 'dup' })])).toThrow(
      /duplicate.*dup/i,
    );
  });

  it('rejects an empty sprite list', () => {
    expect(() => buildAtlas([])).toThrow(/at least one/i);
  });
});

describe('the committed sprite set', () => {
  it('contains at least one sprite', () => {
    expect(SPRITES.length).toBeGreaterThan(0);
  });

  it('is entirely valid', () => {
    expect.assertions(SPRITES.length);
    for (const sprite of SPRITES) {
      expect(() => {
        validateSprite(sprite);
      }).not.toThrow();
    }
  });

  it('uses the arcade yellow for pac-man', () => {
    /* #FFFF00 is the arcade's Pac-Man. Pinned so a future palette tweak is a
       deliberate decision rather than a drift nobody noticed. */
    expect(ARCADE_PALETTE.PACMAN).toBe('#ffff00');
  });

  it('gives every sprite a unique name', () => {
    const names = SPRITES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
