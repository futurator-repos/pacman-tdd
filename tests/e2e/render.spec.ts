import { expect, test } from '@playwright/test';

/**
 * End-to-end rendering checks: the real browser, the real atlas, real pixels.
 *
 * The unit tests prove the renderer emits the right draw calls. Only this can
 * prove those calls put the right colours on screen — the atlas actually
 * loaded, the frame coordinates were right, and nothing blurred on the way.
 */
test.describe('rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-ready', 'true');
  });

  test('draws something rather than leaving the canvas blank', async ({ page }) => {
    const litPixels = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#game');
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return 0;

      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 3; i < data.length; i += 4) {
        if ((data[i] ?? 0) > 0) count++;
      }
      return count;
    });

    /* A blank canvas is the failure mode this catches: everything "passes",
       nothing is drawn. Pac-Man alone covers well over 100 pixels. */
    expect(litPixels).toBeGreaterThan(100);
  });

  test('draws pac-man in the arcade yellow', async ({ page }) => {
    const pixel = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#game');
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return null;

      /* Pac-Man is drawn at (104, 136) and is 16x16; his centre-left is solid
         body regardless of mouth frame. */
      const { data } = ctx.getImageData(108, 144, 1, 1);
      return { r: data[0], g: data[1], b: data[2], a: data[3] };
    });

    expect(pixel).toEqual({ r: 255, g: 255, b: 0, a: 255 });
  });

  test('keeps sprite edges hard, with no interpolation', async ({ page }) => {
    const hasIntermediateColours = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#game');
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return true;

      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] ?? 0;
        /* Bilinear interpolation produces partially transparent edge pixels.
           Nearest-neighbour produces only 0 or 255. */
        if (alpha > 0 && alpha < 255) return true;
      }
      return false;
    });

    expect(hasIntermediateColours).toBe(false);
  });

  test('matches the committed visual baseline', async ({ page }) => {
    /* Catches any change in what is drawn — a moved sprite, a changed colour,
       a corrupted atlas. It detects change, not wrongness: the baseline itself
       is verified by a human looking at it. */
    await expect(page.getByTestId('game-canvas')).toHaveScreenshot('walking-skeleton.png');
  });
});
