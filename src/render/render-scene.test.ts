import { describe, expect, it } from 'vitest';

import { type DrawSurface } from './draw-surface.ts';
import { renderScene } from './render-scene.ts';

type Call =
  | { readonly op: 'clear' }
  | { readonly op: 'drawSprite'; readonly name: string; readonly x: number; readonly y: number };

/**
 * A recording stub standing in for a real canvas.
 *
 * This is why DrawSurface has two methods instead of being the canvas context:
 * the whole of the scene-drawing logic can be checked by reading back a list
 * of calls, with no browser and no image decoding involved.
 */
function recordingSurface(): DrawSurface & { readonly calls: readonly Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    clear(): void {
      calls.push({ op: 'clear' });
    },
    drawSprite(name: string, x: number, y: number): void {
      calls.push({ op: 'drawSprite', name, x, y });
    },
  };
}

describe('renderScene', () => {
  it('clears the surface before drawing anything', () => {
    const surface = recordingSurface();

    renderScene(surface, { sprites: [{ name: 'pellet', x: 0, y: 0 }] });

    expect(surface.calls[0]).toEqual({ op: 'clear' });
  });

  it('clears even when there is nothing to draw', () => {
    const surface = recordingSurface();

    renderScene(surface, { sprites: [] });

    /* Otherwise the previous frame stays on screen — a stale-image bug that
       looks like the game has frozen. */
    expect(surface.calls).toEqual([{ op: 'clear' }]);
  });

  it('draws every sprite in the scene', () => {
    const surface = recordingSurface();

    renderScene(surface, {
      sprites: [
        { name: 'pacman-closed', x: 8, y: 16 },
        { name: 'pellet', x: 24, y: 32 },
      ],
    });

    expect(surface.calls).toEqual([
      { op: 'clear' },
      { op: 'drawSprite', name: 'pacman-closed', x: 8, y: 16 },
      { op: 'drawSprite', name: 'pellet', x: 24, y: 32 },
    ]);
  });

  it('draws sprites in array order, so the array is the z-order', () => {
    const surface = recordingSurface();

    renderScene(surface, {
      sprites: [
        { name: 'pellet', x: 0, y: 0 },
        { name: 'pacman-closed', x: 0, y: 0 },
      ],
    });

    const drawn = surface.calls
      .filter((call): call is Extract<Call, { op: 'drawSprite' }> => call.op === 'drawSprite')
      .map((call) => call.name);

    expect(drawn).toEqual(['pellet', 'pacman-closed']);
  });

  describe('pixel snapping', () => {
    /**
     * Pixel art drawn at a fractional coordinate gets interpolated by the
     * browser and turns blurry. Movement produces fractional positions all the
     * time, so the renderer snaps. This is invisible to every gameplay
     * assertion and very visible on screen, which is exactly why it needs a
     * test of its own.
     */
    it('snaps fractional positions to whole pixels', () => {
      const surface = recordingSurface();

      renderScene(surface, { sprites: [{ name: 'pellet', x: 10.4, y: 20.6 }] });

      expect(surface.calls[1]).toEqual({ op: 'drawSprite', name: 'pellet', x: 10, y: 21 });
    });

    it('snaps negative fractional positions consistently', () => {
      const surface = recordingSurface();

      renderScene(surface, { sprites: [{ name: 'pellet', x: -0.5, y: -1.4 }] });

      const call = surface.calls[1];
      expect(call).toBeDefined();
      expect(Number.isInteger((call as Extract<Call, { op: 'drawSprite' }>).x)).toBe(true);
      expect(Number.isInteger((call as Extract<Call, { op: 'drawSprite' }>).y)).toBe(true);
    });
  });

  it('does not mutate the scene it was given', () => {
    const surface = recordingSurface();
    const scene = { sprites: [{ name: 'pellet', x: 1.5, y: 2.5 }] };
    const before = structuredClone(scene);

    renderScene(surface, scene);

    /* The renderer reads state; it never writes it. If snapping mutated the
       scene, positions would drift a little every frame. */
    expect(scene).toEqual(before);
  });
});
