import { expect, test } from '@playwright/test';

/**
 * Smoke tests: is it standing up at all?
 *
 * These run first and everything else depends on them, so a broken build fails
 * in seconds instead of after the full suite has timed out. Named after
 * hardware testing — plug it in and see whether smoke comes out.
 */
test.describe('boot', () => {
  test('serves a page with a game canvas at the arcade resolution', async ({ page }) => {
    await page.goto('/');

    const canvas = page.getByTestId('game-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('width', '224');
    await expect(canvas).toHaveAttribute('height', '288');
  });

  test('finishes booting without reporting an error', async ({ page }) => {
    await page.goto('/');

    /* main() records any startup failure on the body, so a broken atlas or a
       missing manifest surfaces here as a readable message rather than as a
       blank screen. */
    await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('body')).not.toHaveAttribute('data-error');
  });

  test('logs nothing to the console error channel', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-ready', 'true');

    expect(errors).toEqual([]);
  });
});
