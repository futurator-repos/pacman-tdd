import { describe, expect, it, vi } from 'vitest';

import { type AtlasManifest } from '../../assets/atlas.ts';

import { createCanvasSurface } from './canvas-surface.ts';

const manifest: AtlasManifest = {
  width: 64,
  height: 16,
  frames: {
    'pacman-closed': { x: 32, y: 0, w: 16, h: 16 },
    pellet: { x: 48, y: 0, w: 16, h: 16 },
  },
};

function fakeContext(): CanvasRenderingContext2D {
  const canvas = { width: 224, height: 288 };
  return {
    canvas,
    imageSmoothingEnabled: true,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const fakeImage = {} as CanvasImageSource;

describe('createCanvasSurface', () => {
  it('disables image smoothing so pixel art stays sharp', () => {
    const ctx = fakeContext();

    createCanvasSurface(ctx, fakeImage, manifest);

    /* Left on, the browser bilinearly interpolates every upscaled sprite and
       the whole game looks like a blurred photograph of an arcade cabinet. */
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('clears the whole canvas', () => {
    const ctx = fakeContext();
    const surface = createCanvasSurface(ctx, fakeImage, manifest);

    surface.clear();

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 224, 288);
  });

  it('draws the correct atlas region for a named sprite', () => {
    const ctx = fakeContext();
    const surface = createCanvasSurface(ctx, fakeImage, manifest);

    surface.drawSprite('pellet', 10, 20);

    /* Source rectangle comes from the manifest; destination is where the
       caller asked, at the sprite's natural size. */
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeImage, 48, 0, 16, 16, 10, 20, 16, 16);
  });

  it('draws a different region for a different sprite', () => {
    const ctx = fakeContext();
    const surface = createCanvasSurface(ctx, fakeImage, manifest);

    surface.drawSprite('pacman-closed', 0, 0);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeImage, 32, 0, 16, 16, 0, 0, 16, 16);
  });

  it('throws on an unknown sprite name rather than drawing nothing', () => {
    const ctx = fakeContext();
    const surface = createCanvasSurface(ctx, fakeImage, manifest);

    /* Silently skipping would produce an invisible entity and a bug report
       saying "the ghost disappeared sometimes". */
    expect(() => {
      surface.drawSprite('no-such-sprite', 0, 0);
    }).toThrow(/no-such-sprite/);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
