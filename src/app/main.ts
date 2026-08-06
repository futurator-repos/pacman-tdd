import { loadAtlas } from '../platform/load-atlas.ts';
import { createCanvasSurface } from '../render/canvas-surface.ts';
import { type Scene } from '../render/draw-surface.ts';
import { renderScene } from '../render/render-scene.ts';

/**
 * The composition root: the only place that knows about all the layers at
 * once, and the only place allowed to touch real I/O.
 *
 * There is deliberately no logic here to unit-test — this file is excluded
 * from coverage because everything it does is wiring, and wiring is what the
 * end-to-end tests exercise. Any behaviour that grows here should move down
 * into a layer that can be tested directly.
 */

const ATLAS_BASE = '/assets';

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${String(response.status)}`);
  }
  return response.json();
}

function loadImage(url: string): Promise<CanvasImageSource> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve(image);
    });
    image.addEventListener('error', () => {
      reject(new Error(`Failed to load image ${url}`));
    });
    image.src = url;
  });
}

/**
 * A still frame, not a game.
 *
 * The walking skeleton exists to prove every layer connects — sprite sources
 * compile to an atlas, the atlas loads, the renderer draws it to a real
 * canvas. Movement, ghosts and rules arrive in later plans.
 */
function walkingSkeletonScene(): Scene {
  return {
    sprites: [
      { name: 'pacman-right-open', x: 104, y: 136 },
      { name: 'pellet', x: 136, y: 136 },
      { name: 'pellet', x: 152, y: 136 },
      { name: 'pellet', x: 168, y: 136 },
    ],
  };
}

async function main(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (canvas === null) {
    throw new Error('Canvas #game is missing from the document');
  }

  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Could not get a 2D context — the browser may not support canvas');
  }

  const { image, manifest } = await loadAtlas({ fetchJson, loadImage }, ATLAS_BASE);
  const surface = createCanvasSurface(ctx, image, manifest);

  renderScene(surface, walkingSkeletonScene());

  /* The end-to-end tests wait on this rather than on a timeout, so they stay
     fast and do not flake on a slow machine. */
  canvas.dataset['ready'] = 'true';
}

main().catch((error: unknown) => {
  console.error(error);
  document.body.dataset['error'] = error instanceof Error ? error.message : String(error);
});
