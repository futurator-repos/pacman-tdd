import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const isCI = process.env['CI'] !== undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  /* CI retries twice to absorb genuine flake; locally a failure must stay a
     failure, because a retry that hides a race is worse than a red build. */
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['allure-playwright', { resultsDir: 'allure-results/e2e' }],
  ],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  /* Pixel art must compare exactly. A blurred sprite is a real bug, not noise. */
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0 },
  },
  projects: [
    {
      name: 'smoke',
      testMatch: /.*\.smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /.*\.smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['smoke'],
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
