#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

/**
 * Generates the merged Allure report from the unit and e2e result directories.
 *
 * Allure's generator is a Java application. Rather than failing with a stack
 * trace when no JRE is present, this explains the situation and points at the
 * two ways forward — because "Error: spawn java ENOENT" tells you nothing about
 * what to do next.
 */

const RESULTS = 'allure-results';
const REPORT = 'allure-report';

function hasJava() {
  const probe = spawnSync('java', ['-version'], { stdio: 'ignore' });
  return probe.status === 0;
}

function resultDirs() {
  if (!existsSync(RESULTS)) return [];
  return readdirSync(RESULTS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${RESULTS}/${entry.name}`);
}

const dirs = resultDirs();

if (dirs.length === 0) {
  console.error(
    `No results found in ${RESULTS}/.\n` + 'Run `pnpm test` and `pnpm test:e2e` first.',
  );
  process.exit(1);
}

if (!hasJava()) {
  console.error(
    [
      'Allure report generation needs a Java runtime, which is not installed.',
      '',
      `Test results were still written to ${RESULTS}/ — nothing was lost, and CI`,
      'publishes the full HTML report from exactly these files.',
      '',
      'To generate the report locally instead:',
      '',
      '  brew install --cask temurin',
      '  pnpm allure:report',
      '',
      `Found result directories: ${dirs.join(', ')}`,
    ].join('\n'),
  );
  process.exit(1);
}

execFileSync('pnpm', ['exec', 'allure', 'generate', ...dirs, '--clean', '-o', REPORT], {
  stdio: 'inherit',
});

console.warn(`✓ Report written to ${REPORT}/. Open it with: pnpm exec allure open ${REPORT}`);
