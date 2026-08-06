import { type AtlasManifest } from '../../assets/atlas.ts';

import { type DrawSurface } from './draw-surface.ts';

/**
 * Adapts a real canvas context to the DrawSurface interface.
 *
 * This is the entire DOM footprint of the rendering layer. Everything else
 * draws through the two-method interface and is testable without a browser.
 */
export function createCanvasSurface(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  manifest: AtlasManifest,
): DrawSurface {
  /* Set once at construction. Some browsers reset it when the canvas is
     resized, which is a good reason for resizing to go through here too if
     that is ever needed. */
  ctx.imageSmoothingEnabled = false;

  return {
    clear(): void {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },

    drawSprite(name: string, x: number, y: number): void {
      const frame = manifest.frames[name];

      if (frame === undefined) {
        throw new Error(`Unknown sprite '${name}' — it is not in the atlas manifest`);
      }

      ctx.drawImage(atlas, frame.x, frame.y, frame.w, frame.h, x, y, frame.w, frame.h);
    },
  };
}
