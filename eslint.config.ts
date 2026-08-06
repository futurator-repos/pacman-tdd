import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'dist/**',
    'coverage/**',
    'allure-results/**',
    'allure-report/**',
    'playwright-report/**',
    'test-results/**',
    'public/assets/**',
    'node_modules/**',
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          /* Plain-JS tool configs sit outside the TS projects but still
             deserve linting. */
          allowDefaultProject: ['*.config.js'],
          /* app and node are genuinely separate projects (DOM vs Node libs). */
          noWarnOnMultipleProjects: true,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['./tsconfig.app.json', './tsconfig.node.json'],
          alwaysTryTypes: true,
        }),
      ],
    },
    rules: {
      /**
       * A leading underscore marks a parameter that is deliberately unused —
       * required by a signature but not needed by this implementation. Without
       * it, stubs and interface conformance become impossible to write.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      /* ---------------------------------------------------------------
       * The `any` ban. `strictTypeChecked` already flags most of these;
       * they are restated explicitly because they are a stated project
       * requirement, and a silent downgrade should be visible in a diff.
       * The escape hatch is `unknown` plus a type guard.
       * ------------------------------------------------------------- */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      /* Both fire on plugin packages that legitimately expose a default
         alongside named exports (tseslint, importX). Pure noise here. */
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',

      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },

  /* -----------------------------------------------------------------
   * Layer boundaries. This is the architecture, expressed as a rule
   * that fails the build rather than as a paragraph in a README.
   *
   *   core  <-  render      core may not import anything else
   *   core  <-  platform
   *   core  <-  app
   *   nothing may import app (it is the composition root)
   * --------------------------------------------------------------- */
  {
    files: ['src/**/*.ts'],
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/core',
              from: './src/render',
              message:
                'core/ must stay pure. It may not import render/ — the rules cannot know how they are drawn.',
            },
            {
              target: './src/core',
              from: './src/platform',
              message:
                'core/ must stay pure. It may not import platform/ — inject the dependency instead.',
            },
            {
              target: './src/core',
              from: './src/app',
              message: 'core/ must stay pure. Nothing may import the composition root.',
            },
            {
              target: './src/render',
              from: './src/app',
              message: 'Nothing may import app/. It wires the other layers together.',
            },
            {
              target: './src/render',
              from: './src/platform',
              message:
                'render/ draws; platform/ handles input and I/O. Neither may depend on the other.',
            },
            {
              target: './src/platform',
              from: './src/app',
              message: 'Nothing may import app/. It wires the other layers together.',
            },
            {
              target: './src/platform',
              from: './src/render',
              message:
                'platform/ handles input and I/O; render/ draws. Neither may depend on the other.',
            },
          ],
        },
      ],
    },
  },

  /* -----------------------------------------------------------------
   * Determinism in the game rules.
   *
   * Time and randomness must be injected, never read ambiently. This is
   * what lets a test replay ten thousand ticks and assert an exact
   * result, and what makes a bug reproducible from a seed instead of
   * from a description of what someone saw.
   * --------------------------------------------------------------- */
  {
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'core/ is pure. No DOM access.' },
        { name: 'document', message: 'core/ is pure. No DOM access.' },
        { name: 'localStorage', message: 'core/ is pure. Inject storage via platform/.' },
        { name: 'fetch', message: 'core/ is pure. No I/O.' },
        { name: 'setTimeout', message: 'core/ is pure. Time arrives as a deltaMs parameter.' },
        { name: 'setInterval', message: 'core/ is pure. Time arrives as a deltaMs parameter.' },
        {
          name: 'requestAnimationFrame',
          message: 'core/ is pure. The loop belongs in platform/.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'core/ must be deterministic. Inject the seeded Rng instead.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'core/ must be deterministic. Time arrives as a deltaMs parameter.',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'core/ must be deterministic. Time arrives as a deltaMs parameter.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'core/ must be deterministic. Time arrives as a deltaMs parameter.',
        },
      ],
    },
  },

  /* Unit and component tests. */
  {
    files: ['src/**/*.test.ts', 'assets/**/*.test.ts', 'scripts/**/*.test.ts'],
    ...vitest.configs.recommended,
    rules: {
      ...vitest.configs.recommended.rules,
      /**
       * Asserting on a mock — expect(ctx.drawImage) — necessarily passes an
       * unbound method reference, which is the whole point. typescript-eslint
       * documents this as a known false positive in test files. The rule stays
       * on everywhere else.
       */
      '@typescript-eslint/unbound-method': 'off',
      'vitest/expect-expect': 'error',
      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/valid-expect': 'error',
      /* A test whose title does not describe a behaviour is a bad test. */
      'vitest/consistent-test-it': ['error', { fn: 'it', withinDescribe: 'it' }],
    },
  },

  /* End-to-end tests. */
  {
    files: ['tests/e2e/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-skipped-test': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/expect-expect': 'error',
    },
  },

  /* Config files legitimately default-export and touch the environment. */
  {
    files: ['*.config.ts', '*.config.js', 'scripts/**/*.ts'],
    rules: {
      'import-x/no-default-export': 'off',
      'no-console': 'off',
    },
  },

  prettier,
);
