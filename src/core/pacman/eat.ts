/**
 * Consumption, as a pure function: a tile in, the new board plus what happened
 * out.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT KNOW. It does not score. A dot is 10
 * points and an energizer is 50, and both of those numbers live in
 * `rules/points.ts` in slice s08 with their own citation. Keeping them out
 * means the freeze frames and the pellet bookkeeping can be pinned without any
 * test in this file having an opinion about the score.
 */
import { type Tile } from '../geometry/tile.ts';
import { type PelletField, PelletKind, eatAt, pelletAt, remaining } from '../maze/pellets.ts';
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
/* Not exported yet: nothing outside this module names the type, and knip
   treats an export nobody imports as dead weight. `EatResult.events` carries
   the shape structurally, so callers already get full type safety. Slice s10's
   eat-system is the first thing that will need the name, and it can export it
   then — which keeps the public surface a record of what is actually used. */
type EatEvent =
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
 * on (docs/ARCADE-REFERENCE.md section 3). The duration is FORWARDED, never
 * computed here, so a level with no fright at all is a table row rather than a
 * branch in this file.
 *
 * The freeze is attached to the ACT of eating and not to fright starting, which
 * is why `stopFrames` is 3 for an energizer unconditionally — including from
 * level 19, where nothing turns blue. Writing it as a consequence of fright
 * would make the hardest levels in the game quietly easier than level 1.
 *
 * `remaining` is read AFTER the bite, because its consumers — the siren tier,
 * the Cruise Elroy threshold, `levelCleared` — all want the count that is on
 * the board now, not the one that was there a moment ago.
 */
export function eat(field: PelletField, tile: Tile, spec: LevelSpec): EatResult {
  const kind = pelletAt(field, tile);
  if (kind === PelletKind.None) {
    return { pellets: field, events: [], stopFrames: 0 };
  }

  const pellets = eatAt(field, tile);
  if (kind === PelletKind.Pellet) {
    return {
      pellets,
      events: [{ kind: 'pelletEaten', tile, remaining: remaining(pellets) }],
      stopFrames: 1,
    };
  }
  return {
    pellets,
    events: [{ kind: 'powerPelletEaten', tile, frames: spec.frightenedFrames }],
    stopFrames: 3,
  };
}
