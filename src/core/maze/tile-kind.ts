/**
 * What a single maze tile IS, as a closed set of five values.
 *
 * A const object rather than an enum: `erasableSyntaxOnly` is on, so the type
 * layer must vanish completely at build time with no runtime construct left
 * behind. The companion type declaration gives the same ergonomics as an enum.
 *
 * This file is pure vocabulary — it declares no behaviour, so there is nothing
 * here to stub and nothing here to test on its own. The RULES that consume
 * these values (`isWalkable`, `kindAt`) live in `maze.ts` and are tested there.
 */
export const TileKind = {
  /** Never walkable, by anybody, ever. Also what lies off the edge of the grid. */
  Wall: 'wall',
  /** Plain floor. Pac-Man and ghosts both walk here. */
  Open: 'open',
  /**
   * The ghost-house gate. Ghosts may cross it; Pac-Man may not. This asymmetry
   * is the reason `isWalkable` takes a `mayPassDoor` flag instead of being a
   * one-argument predicate.
   */
  Door: 'door',
  /**
   * Open floor, but ghosts crawl through it. The slowdown is a SPEED rule
   * (see `ghost-speed.ts`), never a walkability rule — a tunnel tile is as
   * walkable as any other, which is what stops the two tunnel mouths from
   * silently sealing and making the board impossible to clear.
   */
  Tunnel: 'tunnel',
  /** Inside the ghost house. Occupiable; ghosts wait here for release. */
  House: 'house',
} as const;

export type TileKind = (typeof TileKind)[keyof typeof TileKind];
