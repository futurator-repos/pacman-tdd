import { type AtlasManifest, type Frame } from '../../assets/atlas.ts';

/**
 * Injected rather than reaching for `fetch` and `Image` directly. That is what
 * lets the tests run in milliseconds with no network and no image decoding,
 * and it keeps this module honest about what it actually depends on.
 */
export interface AtlasLoaderDeps {
  readonly fetchJson: (url: string) => Promise<unknown>;
  readonly loadImage: (url: string) => Promise<CanvasImageSource>;
}

export interface AtlasBundle {
  readonly manifest: AtlasManifest;
  readonly image: CanvasImageSource;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(source: Record<string, unknown>, key: string, context: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(
      `Atlas manifest: ${context} '${key}' must be a number, got ${typeof value}`,
    );
  }
  return value;
}

function parseFrame(name: string, value: unknown): Frame {
  if (!isRecord(value)) {
    throw new TypeError(`Atlas manifest: frame '${name}' must be an object`);
  }
  return {
    x: readNumber(value, 'x', `frame '${name}'`),
    y: readNumber(value, 'y', `frame '${name}'`),
    w: readNumber(value, 'w', `frame '${name}'`),
    h: readNumber(value, 'h', `frame '${name}'`),
  };
}

/**
 * Validates the untrusted JSON into a real AtlasManifest.
 *
 * `unknown` plus explicit narrowing rather than a cast: a cast would let a
 * malformed manifest through and surface as an undefined-property error in the
 * render loop, far from its cause.
 */
function parseManifest(value: unknown): AtlasManifest {
  if (!isRecord(value)) {
    throw new TypeError('Atlas manifest must be an object');
  }

  const width = readNumber(value, 'width', 'manifest');
  const height = readNumber(value, 'height', 'manifest');

  const rawFrames = value['frames'];
  if (!isRecord(rawFrames)) {
    throw new TypeError('Atlas manifest: frames must be an object');
  }

  const frames: Record<string, Frame> = {};
  for (const [name, frame] of Object.entries(rawFrames)) {
    frames[name] = parseFrame(name, frame);
  }

  return { width, height, frames };
}

/** Loads the atlas image and its manifest from `baseUrl`. */
export async function loadAtlas(deps: AtlasLoaderDeps, baseUrl: string): Promise<AtlasBundle> {
  const [raw, image] = await Promise.all([
    deps.fetchJson(`${baseUrl}/atlas.json`),
    deps.loadImage(`${baseUrl}/atlas.png`),
  ]);

  return { manifest: parseManifest(raw), image };
}
