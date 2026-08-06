import { type SpriteSource } from './sprite-source.ts';

/**
 * STUB - signatures only, no behaviour. See docs/TDD-CHARTER.md, Challenge 1.
 */

export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface AtlasManifest {
  readonly width: number;
  readonly height: number;
  readonly frames: Readonly<Record<string, Frame>>;
}

export interface BuiltAtlas {
  readonly manifest: AtlasManifest;
  readonly rgba: Uint8Array;
}

export function validateSprite(_sprite: SpriteSource): void {
  /* no behaviour yet */
}

export function buildAtlas(_sprites: readonly SpriteSource[]): BuiltAtlas {
  return {
    manifest: { width: 0, height: 0, frames: {} },
    rgba: new Uint8Array(0),
  };
}
