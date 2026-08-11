import { type LevelSpec } from '../rules/level-spec.ts';

import { GHOST_ORDER, type GhostId } from './ghost-id.ts';
import { type Ghost, GhostPhase } from './ghost.ts';

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
 * A pure function of the board rather than a flag that gets set and cleared, so
 * there is no state to leave stale: the caller recomputes it and Blinky's speed
 * follows the dots automatically, including BACKWARDS when the house refills
 * after a death. That is the suspension rule, and it is checked first for the
 * same reason it is easy to lose in a refactor — with three ghosts penned after
 * a death, an unsuspended Blinky bears down on a stationary Pac-Man at 85%.
 *
 * `InHouse` alone counts as "inside the house": a ghost in `LeavingHouse` is
 * already walking out through the gate, which is the same reading the release
 * rule takes in `house.ts`.
 *
 * The thresholds are `<=` because they are stated as dots REMAINING — at ten
 * left the stage has been reached, not passed — and stage 2 is tested first so
 * that the two bands cannot overlap.
 */
export function elroyStage(input: ElroyInput): number {
  const { dotsRemaining, spec, ghosts } = input;

  if (GHOST_ORDER.some((id) => ghosts[id].phase === GhostPhase.InHouse)) {
    return 0;
  }
  if (dotsRemaining <= spec.elroy2DotsLeft) {
    return 2;
  }
  if (dotsRemaining <= spec.elroy1DotsLeft) {
    return 1;
  }
  return 0;
}
