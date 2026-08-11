import { type TileKind } from '../maze/tile-kind.ts';
import { type LevelSpec } from '../rules/level-spec.ts';

import { type Ghost } from './ghost.ts';

/**
 * Which speed row applies to this ghost, this frame.
 *
 * A `TileKind` rather than a `Maze` plus a position, on purpose: the rule is a
 * SELECTION over a record, and handing it the board would drag maze parsing and
 * pixel arithmetic into a test whose only question is "which of five numbers".
 * The caller already holds the maze and `kindAt` is total, so composing them is
 * the ghost system's job (slice s11).
 *
 * docs/ARCADE-REFERENCE.md section 11, "Ghost speed selection".
 */
export interface GhostSpeedInput {
  readonly ghost: Ghost;
  readonly spec: LevelSpec;
  /** The kind of tile the ghost currently occupies. */
  readonly tileKind: TileKind;
}

/**
 * SIGNATURE-ONLY STUB — no behaviour. Returns zero sub-pixels per frame, which
 * is a value the real rule can never produce: every fraction in the arcade
 * table is positive, so a ghost that does not move is unambiguously the stub
 * and not a slow ghost.
 */
export function ghostSpeed(_input: GhostSpeedInput): number {
  return 0;
}
