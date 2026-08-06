import { type AtlasManifest } from '../../assets/atlas.ts';

/**
 * STUB - signatures only, no behaviour. See docs/TDD-CHARTER.md, Challenge 1.
 */

export interface AtlasLoaderDeps {
  readonly fetchJson: (url: string) => Promise<unknown>;
  readonly loadImage: (url: string) => Promise<CanvasImageSource>;
}

export interface AtlasBundle {
  readonly manifest: AtlasManifest;
  readonly image: CanvasImageSource;
}

export function loadAtlas(_deps: AtlasLoaderDeps, _baseUrl: string): Promise<AtlasBundle> {
  return Promise.resolve({
    manifest: { width: 0, height: 0, frames: {} },
    image: {} as CanvasImageSource,
  });
}
