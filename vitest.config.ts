import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

const alias = {
  '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
  '@render': fileURLToPath(new URL('./src/render', import.meta.url)),
  '@platform': fileURLToPath(new URL('./src/platform', import.meta.url)),
  '@assets': fileURLToPath(new URL('./assets', import.meta.url)),
};

/**
 * Two projects, deliberately separated.
 *
 * `core` runs in Node with no DOM whatsoever. That is not a performance choice:
 * it means a stray `document` reference in the game rules fails at test time
 * rather than passing quietly. The architecture rule is enforced by the runtime,
 * not just by lint.
 *
 * `dom` runs in jsdom for the renderer and platform adapters, which legitimately
 * touch browser APIs.
 */
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['allure-vitest/setup'],
    reporters: ['default', ['allure-vitest/reporter', { resultsDir: 'allure-results/unit' }]],
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'core',
          environment: 'node',
          globals: true,
          setupFiles: ['allure-vitest/setup'],
          include: ['src/core/**/*.test.ts', 'assets/**/*.test.ts', 'scripts/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'dom',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['allure-vitest/setup'],
          include: ['src/render/**/*.test.ts', 'src/platform/**/*.test.ts', 'src/app/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'assets/**/*.ts', 'scripts/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/app/main.ts', '**/index.ts', '**/*.d.ts'],
      thresholds: {
        // The pure game rules carry the whole design. They are 100% or the build fails.
        'src/core/**/*.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
