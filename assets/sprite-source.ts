/**
 * Pixel art authored as data.
 *
 * A sprite is a palette plus rows of single-character keys. This is the source
 * of truth; the PNG atlas is a build artifact generated from it. The point is
 * reviewability — a change to a sprite shows up in a diff as changed pixels,
 * not as an opaque binary blob nobody can inspect.
 */

/** `null` means transparent. Anything else is a `#rrggbb` colour. */
export type Palette = Readonly<Record<string, string | null>>;

export interface SpriteSource {
  /** Identifier used to look the sprite up in the generated atlas. */
  readonly name: string;
  readonly palette: Palette;
  /** One string per row; one character per pixel. */
  readonly pixels: readonly string[];
}

/** Every sprite in the game is 16x16, matching the arcade hardware. */
export const SPRITE_SIZE = 16;
