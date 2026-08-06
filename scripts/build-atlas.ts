import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

import { buildAtlas } from '../assets/atlas.ts';
import { SPRITES } from '../assets/sprites.ts';

/**
 * Compiles the typed pixel sources into a PNG atlas plus a JSON manifest.
 *
 * With `--check` it regenerates into memory and compares against what is
 * committed, failing if they differ. That catches both a stale atlas (someone
 * edited a sprite and forgot to rebuild) and a hand-edited PNG (someone
 * bypassed the source of truth). CI runs the check; a human runs the build.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'assets');
const PNG_PATH = join(OUT_DIR, 'atlas.png');
const JSON_PATH = join(OUT_DIR, 'atlas.json');

function render(): { png: Buffer; json: string } {
  const { manifest, rgba } = buildAtlas(SPRITES);

  const image = new PNG({ width: manifest.width, height: manifest.height });
  image.data = Buffer.from(rgba);

  return {
    png: PNG.sync.write(image),
    json: `${JSON.stringify(manifest, null, 2)}\n`,
  };
}

function main(): void {
  const isCheck = process.argv.includes('--check');
  const { png, json } = render();

  if (isCheck) {
    if (!existsSync(PNG_PATH) || !existsSync(JSON_PATH)) {
      console.error('✗ Atlas is missing. Run `pnpm assets:build`.');
      process.exit(1);
    }

    const pngMatches = readFileSync(PNG_PATH).equals(png);
    const jsonMatches = readFileSync(JSON_PATH, 'utf8') === json;

    if (!pngMatches || !jsonMatches) {
      console.error(
        '✗ The committed atlas does not match the sprite sources.\n' +
          '  Either a sprite changed without a rebuild, or the atlas was edited\n' +
          '  by hand. Run `pnpm assets:build` and commit the result.',
      );
      process.exit(1);
    }

    console.warn(`✓ Atlas is up to date (${String(SPRITES.length)} sprites)`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(PNG_PATH, png);
  writeFileSync(JSON_PATH, json);
  console.warn(`✓ Wrote ${String(SPRITES.length)} sprites to public/assets/atlas.png`);
}

main();
