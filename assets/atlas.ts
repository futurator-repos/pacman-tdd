import { SPRITE_SIZE, type SpriteSource } from './sprite-source.ts';

/** Where one sprite sits inside the atlas image. */
export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The atlas description the renderer loads at runtime. */
export interface AtlasManifest {
  readonly width: number;
  readonly height: number;
  readonly frames: Readonly<Record<string, Frame>>;
}

export interface BuiltAtlas {
  readonly manifest: AtlasManifest;
  /** Raw RGBA bytes, four per pixel, row-major. */
  readonly rgba: Uint8Array;
}

const CHANNELS = 4;
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/**
 * Fails loudly on a malformed sprite.
 *
 * Every check here corresponds to a mistake that is otherwise very hard to
 * spot: a short row shifts every pixel after it, and an unpalettised character
 * renders as a transparent hole that looks like a rendering bug rather than a
 * typo in the art.
 */
export function validateSprite(sprite: SpriteSource): void {
  if (sprite.pixels.length !== SPRITE_SIZE) {
    throw new Error(
      `Sprite '${sprite.name}' must have exactly ${String(SPRITE_SIZE)} rows, found ${String(sprite.pixels.length)}`,
    );
  }

  for (const [index, row] of sprite.pixels.entries()) {
    if (row.length !== SPRITE_SIZE) {
      throw new Error(
        `Sprite '${sprite.name}' row ${String(index)} must be ${String(SPRITE_SIZE)} pixels wide, found ${String(row.length)}`,
      );
    }

    for (const char of row) {
      if (!(char in sprite.palette)) {
        throw new Error(
          `Sprite '${sprite.name}' row ${String(index)} uses '${char}', which is not in its palette`,
        );
      }
    }
  }

  for (const [key, colour] of Object.entries(sprite.palette)) {
    if (colour !== null && !HEX_COLOUR.test(colour)) {
      throw new Error(
        `Sprite '${sprite.name}' palette entry '${key}' must be a #rrggbb colour or null, found '${colour}'`,
      );
    }
  }
}

function parseHex(colour: string): readonly [number, number, number] {
  return [
    Number.parseInt(colour.slice(1, 3), 16),
    Number.parseInt(colour.slice(3, 5), 16),
    Number.parseInt(colour.slice(5, 7), 16),
  ];
}

/**
 * Packs sprites into a single horizontal strip.
 *
 * A strip rather than a grid: with sprites of one fixed size the layout maths
 * stays trivial, and a texture 16px tall costs nothing on any GPU made this
 * century. If the sprite count ever makes the strip unwieldy, the manifest
 * already carries explicit coordinates, so the layout can change without any
 * renderer change at all.
 */
export function buildAtlas(sprites: readonly SpriteSource[]): BuiltAtlas {
  if (sprites.length === 0) {
    throw new Error('An atlas needs at least one sprite');
  }

  const seen = new Set<string>();
  for (const sprite of sprites) {
    if (seen.has(sprite.name)) {
      throw new Error(`Duplicate sprite name '${sprite.name}'`);
    }
    seen.add(sprite.name);
    validateSprite(sprite);
  }

  const width = sprites.length * SPRITE_SIZE;
  const height = SPRITE_SIZE;
  const rgba = new Uint8Array(width * height * CHANNELS);
  const frames: Record<string, Frame> = {};

  for (const [index, sprite] of sprites.entries()) {
    const originX = index * SPRITE_SIZE;
    frames[sprite.name] = { x: originX, y: 0, w: SPRITE_SIZE, h: SPRITE_SIZE };

    for (const [rowIndex, row] of sprite.pixels.entries()) {
      /* charAt rather than spreading the string: pixel keys are single ASCII
         characters, and spreading would iterate code points, which is both
         slower and wrong for anything outside the BMP. */
      for (let colIndex = 0; colIndex < SPRITE_SIZE; colIndex++) {
        const char = row.charAt(colIndex);
        const colour = sprite.palette[char] ?? null;
        const offset = (rowIndex * width + originX + colIndex) * CHANNELS;

        if (colour === null) {
          /* Uint8Array is already zero-filled: transparent black. */
          continue;
        }

        const [r, g, b] = parseHex(colour);
        rgba[offset] = r;
        rgba[offset + 1] = g;
        rgba[offset + 2] = b;
        rgba[offset + 3] = 0xff;
      }
    }
  }

  return { manifest: { width, height, frames }, rgba };
}
