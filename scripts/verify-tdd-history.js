#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

/**
 * Checks that the TDD process actually happened, by reading git history.
 *
 * The charter makes two claims. This turns both into a build step, because a
 * claim an agent makes about its own process is worth exactly nothing unless
 * something else can check it.
 *
 *   1. Every [RED] commit is followed by a [GREEN] commit.
 *   2. No test file changed between them. If the tests moved while the
 *      implementation was being written, the implementation was written to fit
 *      the tests — or worse, the tests were bent to fit the implementation.
 *
 * A test may absolutely change later; it just needs its own commit saying why.
 * See docs/TDD-CHARTER.md, Challenge 2.
 */

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const log = git('log', '--reverse', '--format=%H%x00%s', 'HEAD')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [sha, subject] = line.split('\0');
    return { sha, subject };
  });

const failures = [];
let checked = 0;

for (const [index, commit] of log.entries()) {
  if (!commit.subject.includes('[RED]')) continue;

  const green = log.slice(index + 1).find((c) => c.subject.includes('[GREEN]'));

  if (!green) {
    failures.push(`${commit.sha.slice(0, 7)} "${commit.subject}" has no following [GREEN] commit`);
    continue;
  }

  const movedTests = git('diff', '--name-only', commit.sha, green.sha, '--', '*.test.ts', '*.spec.ts')
    .split('\n')
    .filter(Boolean);

  if (movedTests.length > 0) {
    failures.push(
      `Test files changed between ${commit.sha.slice(0, 7)} [RED] and ` +
        `${green.sha.slice(0, 7)} [GREEN]:\n    ${movedTests.join('\n    ')}`,
    );
  }

  checked++;
}

if (failures.length > 0) {
  console.error('✗ TDD history check failed:\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    '\nA test may change, but only in its own commit with a stated reason —\n' +
      'never silently inside a green step. See docs/TDD-CHARTER.md.',
  );
  process.exit(1);
}

console.warn(`✓ TDD history check passed: ${String(checked)} RED->GREEN pairs, no tests altered`);
