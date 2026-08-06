import { describe, expect, it, vi } from 'vitest';

import { loadAtlas, type AtlasLoaderDeps } from './load-atlas.ts';

const validManifest = {
  width: 64,
  height: 16,
  frames: { pellet: { x: 48, y: 0, w: 16, h: 16 } },
};

const fakeImage = {} as CanvasImageSource;

function deps(overrides: Partial<AtlasLoaderDeps> = {}): AtlasLoaderDeps {
  return {
    fetchJson: vi.fn().mockResolvedValue(validManifest),
    loadImage: vi.fn().mockResolvedValue(fakeImage),
    ...overrides,
  };
}

describe('loadAtlas', () => {
  it('returns the manifest and the image together', async () => {
    const bundle = await loadAtlas(deps(), '/assets');

    expect(bundle.manifest).toEqual(validManifest);
    expect(bundle.image).toBe(fakeImage);
  });

  it('reads the manifest and image from the given base path', async () => {
    const d = deps();

    await loadAtlas(d, '/assets');

    expect(d.fetchJson).toHaveBeenCalledWith('/assets/atlas.json');
    expect(d.loadImage).toHaveBeenCalledWith('/assets/atlas.png');
  });

  describe('validation', () => {
    /**
     * The manifest arrives as untyped JSON over the network. Trusting its shape
     * would push a TypeError deep into the render loop, thousands of frames
     * from the actual cause. It is checked once, here, at the boundary.
     */
    it('rejects a manifest that is not an object', async () => {
      const d = deps({ fetchJson: vi.fn().mockResolvedValue('nonsense') });

      await expect(loadAtlas(d, '/assets')).rejects.toThrow(/manifest/i);
    });

    it('rejects a manifest with no frames', async () => {
      const d = deps({ fetchJson: vi.fn().mockResolvedValue({ width: 1, height: 1 }) });

      await expect(loadAtlas(d, '/assets')).rejects.toThrow(/frames/i);
    });

    it('rejects a frame that is missing a coordinate', async () => {
      const d = deps({
        fetchJson: vi.fn().mockResolvedValue({
          width: 64,
          height: 16,
          frames: { pellet: { x: 48, y: 0, w: 16 } },
        }),
      });

      await expect(loadAtlas(d, '/assets')).rejects.toThrow(/pellet/);
    });

    it('rejects non-numeric dimensions', async () => {
      const d = deps({
        fetchJson: vi.fn().mockResolvedValue({ width: '64', height: 16, frames: {} }),
      });

      await expect(loadAtlas(d, '/assets')).rejects.toThrow(/width/i);
    });
  });

  it('propagates a network failure rather than returning an empty atlas', async () => {
    const d = deps({ fetchJson: vi.fn().mockRejectedValue(new Error('offline')) });

    await expect(loadAtlas(d, '/assets')).rejects.toThrow('offline');
  });
});
