import { type LevelSpec } from '../rules/level-spec.ts';

import { type GhostId } from './ghost-id.ts';
import { type Ghost } from './ghost.ts';

/**
 * Everything Cruise Elroy depends on.
 *
 * `dotsRemaining` rather than `dotsEaten`, and the field name is the test: the
 * arcade table counts DOWN, so a threshold of 20 means "twenty dots left", not
 * "twenty dots eaten". Reading it the other way round inverts the difficulty
 * curve — Blinky sprints at the start of a level and dawdles at the end — while
 * still looking like a working feature.
 *
 * The whole ghost record is passed rather than a pre-computed
 * `anyGhostInHouse` boolean, so the suspension rule cannot be silently
 * satisfied by a caller that forgot to compute it.
 *
 * docs/ARCADE-REFERENCE.md section 5, "Cruise Elroy".
 */
export interface ElroyInput {
  readonly dotsRemaining: number;
  readonly spec: LevelSpec;
  readonly ghosts: Readonly<Record<GhostId, Ghost>>;
}

/**
 * Blinky's Cruise Elroy stage: 0 (off), 1 or 2.
 *
 * SIGNATURE-ONLY STUB — returns 0, "not Elroy". Note honestly that 0 is also
 * the correct answer for two of the tests below, which is exactly the situation
 * docs/TDD-FINDINGS.md calls a GUARD: those tests pin nothing on their own and
 * only earn their keep once the stage rule is implemented. Each says so in its
 * LOAD-BEARING line.
 */
export function elroyStage(_input: ElroyInput): number {
  return 0;
}
