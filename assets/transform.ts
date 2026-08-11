import { SPRITE_SIZE, type Palette, type SpriteSource } from './sprite-source.ts';

/**
 * Pure transforms for deriving sprites from base shapes.
 *
 * A full Pac-Man needs around fifty sprites. Authoring them all by hand would
 * be unreviewable, so instead a handful of base shapes are authored and the
 * rest are derived: one right-facing Pac-Man becomes four directions, one ghost
 * body becomes four ghosts.
 *
 * Every function here is pure. That is load-bearing rather than stylistic: the
 * same base sprite is transformed several times to produce several outputs, so
 * an in-place mutation would compound across derivations and corrupt them all.
 */

/** Reads one pixel, or `'_'` if the coordinates fall outside the grid. */
function pixelAt(pixels: readonly string[], row: number, col: number): string {
  return pixels[row]?.charAt(col) ?? '_';
}

/**
 * Rotates a sprite 90 degrees clockwise.
 *
 * `new[r][c] = old[N-1-c][r]`, which is the standard clockwise mapping. Deriving
 * the four facings is then three successive calls: right → down → left → up.
 */
export function rotateClockwise(sprite: SpriteSource, name?: string): SpriteSource {
  const pixels = Array.from({ length: SPRITE_SIZE }, (_unused, row) =>
    Array.from({ length: SPRITE_SIZE }, (_alsoUnused, col) =>
      pixelAt(sprite.pixels, SPRITE_SIZE - 1 - col, row),
    ).join(''),
  );

  return { name: name ?? sprite.name, palette: sprite.palette, pixels };
}

/**
 * Mirrors a sprite left-to-right.
 *
 * Used for the left-facing Pac-Man. A mirror rather than two rotations, because
 * rotating a face onto its side is not the same as reflecting it — the mouth
 * would end up pointing the right way but the highlight would be upside down.
 */
export function mirrorHorizontal(sprite: SpriteSource, name?: string): SpriteSource {
  const pixels = sprite.pixels.map((row) =>
    Array.from({ length: SPRITE_SIZE }, (_unused, col) => row.charAt(SPRITE_SIZE - 1 - col)).join(
      '',
    ),
  );

  return { name: name ?? sprite.name, palette: sprite.palette, pixels };
}

/**
 * Produces a colour variant of a sprite, sharing its pixel data.
 *
 * This is how four ghosts come from one body: identical shape, different body
 * colour, identical eyes.
 *
 * Overriding a key that is not already in the palette is an error rather than
 * an addition. Without that check, a typo — `{ Bo: '#ff0000' }` instead of
 * `{ B: '#ff0000' }` — would produce a sprite that is simply the wrong colour,
 * with nothing anywhere reporting a problem.
 */
export function recolour(sprite: SpriteSource, name: string, overrides: Palette): SpriteSource {
  const palette: Record<string, string | null> = { ...sprite.palette };

  for (const [key, colour] of Object.entries(overrides)) {
    if (!(key in sprite.palette)) {
      throw new Error(
        `Cannot recolour '${key}' in sprite '${sprite.name}': that key is not in its palette`,
      );
    }
    palette[key] = colour;
  }

  return { name, palette, pixels: sprite.pixels };
}
