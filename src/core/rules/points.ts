/**
 * Every point value in the game, in one file.
 *
 * There is no `points.test.ts`. That is deliberate rather than an omission: a
 * file of bare constants asserted by a test file of the same name is a mirror,
 * and a mirror cannot disagree with what it reflects. These values are pinned
 * where they are USED — `score.test.ts` asserts the eating values and the extra
 * life, `ghost-combo.test.ts` asserts the ladder through `ghostPoints` — so
 * every assertion in the suite is about a rule the game actually applies.
 *
 * What is NOT here, and why: the fruit table. A bonus item's value varies by
 * level, and `LevelSpec.fruitPoints` already carries it (docs/ARCADE-REFERENCE.md
 * section 3, the Points column) because that is where the arcade itself prints
 * it. A second table keyed by `FruitKind` would be the same fact written twice,
 * with nothing to keep the two copies in step — see section 13.4.
 *
 * STUB (slice s08 RED): the values below are deliberately inert zeros and an
 * empty ladder. Every number in this file is asserted by a test that must fail
 * against it.
 */

/**
 * What Pac-Man's mouth is worth.
 *
 * A record rather than two loose constants, so a call site reads
 * `POINTS.powerPellet` and cannot silently pick up the wrong one of two numbers
 * that are both small integers.
 */
export interface PointsTable {
  /** docs/ARCADE-REFERENCE.md section 13.1: a plain dot. */
  readonly pellet: number;
  /** docs/ARCADE-REFERENCE.md section 13.1: an energizer. */
  readonly powerPellet: number;
}

export const POINTS: PointsTable = {
  pellet: 0,
  powerPellet: 0,
};

/**
 * The doubling ladder, indexed by how many ghosts have already been eaten
 * during the current fright. docs/ARCADE-REFERENCE.md section 13.2.
 *
 * Data rather than `200 * 2 ** n`, because the arcade's ladder is a table that
 * happens to double and not a formula that happens to match: a table cannot
 * accidentally produce a fifth rung.
 */
export const GHOST_POINTS: readonly number[] = [];

/**
 * The score at which the player is given one extra life, once per game.
 * docs/ARCADE-REFERENCE.md section 13.3.
 */
export const EXTRA_LIFE_AT = 0;
