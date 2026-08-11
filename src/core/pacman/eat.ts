/**
 * Consumption, as a pure function: a tile in, the new board plus what happened
 * out.
 *
 * SIGNATURE-ONLY STUB — slice s07 RED phase. Returns the field it was given,
 * no events and no freeze.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT KNOW. It does not score. A dot is 10
 * points and an energizer is 50, and both of those numbers live in
 * `rules/points.ts` in slice s08 with their own citation. Keeping them out
 * means the freeze frames and the pellet bookkeeping can be pinned without any
 * test in this file having an opinion about the score.
 */
import { type Tile } from '../geometry/tile.ts';
import { type PelletField } from '../maze/pellets.ts';
import { type LevelSpec } from '../rules/level-spec.ts';

/**
 * What eating produced, as events.
 *
 * These two variants are a deliberate STRUCTURAL SUBSET of two `GameEvent`
 * variants declared in slice s09 — same `kind` strings, same field names,
 * same types — so slice s10's eat-system forwards them straight through
 * instead of translating them. They are re-declared here rather than imported
 * because `game-event.ts` belongs to a later slice, and a leaf module that
 * reached forward into it would invert the dependency order.
 */
export type EatEvent =
  | { readonly kind: 'pelletEaten'; readonly tile: Tile; readonly remaining: number }
  | { readonly kind: 'powerPelletEaten'; readonly tile: Tile; readonly frames: number };

/**
 * The complete answer. Note what is absent: no points, and no score.
 *
 * `stopFrames` is how long Pac-Man does not move — 1 for a dot, 3 for an
 * energizer (docs/ARCADE-REFERENCE.md section 8.2). This function REPORTS the
 * number; slice s10's pacman-system is what skips the move and counts it down.
 */
export interface EatResult {
  readonly pellets: PelletField;
  readonly events: readonly EatEvent[];
  readonly stopFrames: number;
}

/**
 * Eat whatever is on `tile`.
 *
 * Takes the whole `LevelSpec` because an energizer's event has to carry the
 * level's fright duration, which is 360 frames at level 1 and 0 from level 19
 * on (docs/ARCADE-REFERENCE.md section 3).
 */
export function eat(field: PelletField, _tile: Tile, _spec: LevelSpec): EatResult {
  return { pellets: field, events: [], stopFrames: 0 };
}
