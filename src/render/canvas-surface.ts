import { type AtlasManifest } from '../../assets/atlas.ts';

import { type DrawSurface } from './draw-surface.ts';

/**
 * STUB - signature only, no behaviour. See docs/TDD-CHARTER.md, Challenge 1.
 */
export function createCanvasSurface(
  _ctx: CanvasRenderingContext2D,
  _atlas: CanvasImageSource,
  _manifest: AtlasManifest,
): DrawSurface {
  return {
    clear(): void {
      /* no behaviour yet */
    },
    drawSprite(_name: string, _x: number, _y: number): void {
      /* no behaviour yet */
    },
  };
}
