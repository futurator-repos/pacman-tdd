import type { Tile } from '../../geometry/tile.ts';
import type { Ghost } from '../ghost.ts';

import type { TargetContext } from './target-context.ts';

/**
 * The one dispatch point from a ghost's id and phase to the tile it is steering
 * for. Everything else in `targeting/` is a leaf rule; this is the only file
 * that knows all four of them exist.
 */
/* STUB — slice s05 RED phase. Signature only, no behaviour, and deliberately
   NOT delegating to any personality yet: a stub that already called
   blinkyTarget would be an implementation wearing a stub's clothes. */
export function targetFor(_ghost: Ghost, _ctx: TargetContext): Tile {
  return { col: 0, row: 0 };
}
