/**
 * Conventional commits, with two additions that matter for this project.
 *
 * The TDD cycle is recorded in history, so commit subjects carry a [RED] or
 * [GREEN] marker. `subject-case` is relaxed to allow them, and the header is
 * given room to hold a scope plus a marker plus a readable description.
 *
 * See docs/TDD-CHARTER.md.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'subject-case': [0],
    'body-max-line-length': [2, 'always', 100],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'test',
        'refactor',
        'docs',
        'build',
        'ci',
        'chore',
        'perf',
        'style',
        'revert',
      ],
    ],
  },
};
