import { type Palette, type SpriteSource } from './sprite-source.ts';

/**
 * STUB - signatures only, no behaviour. Present so the tests execute and fail
 * on their assertions rather than on "Cannot find module".
 * See docs/TDD-CHARTER.md, Challenge 1.
 */

export function rotateClockwise(sprite: SpriteSource, _name?: string): SpriteSource {
  return sprite;
}

export function mirrorHorizontal(sprite: SpriteSource, _name?: string): SpriteSource {
  return sprite;
}

export function recolour(sprite: SpriteSource, _name: string, _overrides: Palette): SpriteSource {
  return sprite;
}
