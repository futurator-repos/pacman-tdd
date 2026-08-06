import { type DrawSurface, type Scene } from './draw-surface.ts';

/**
 * Draws one frame.
 *
 * The entire drawing policy of the game lives here, and it is deliberately
 * dull: clear, then draw each sprite in order at a whole-pixel position. Any
 * decision more interesting than that belongs in the rules, not the renderer.
 */
export function renderScene(surface: DrawSurface, scene: Scene): void {
  surface.clear();

  for (const sprite of scene.sprites) {
    /* Math.round rather than a bitwise truncation: `| 0` rounds toward zero,
       so a sprite crossing x = 0 would stutter as it changed sign. */
    surface.drawSprite(sprite.name, Math.round(sprite.x), Math.round(sprite.y));
  }
}
