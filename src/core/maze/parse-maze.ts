import { type Tile, tileEquals } from '../geometry/tile.ts';
import { GHOST_ORDER, GhostId } from '../ghost/ghost-id.ts';

import { MazeGlyph } from './classic-layout.ts';
import { type Maze, kindAt } from './maze.ts';
import { TileKind } from './tile-kind.ts';

/**
 * What each legend character IS, as terrain.
 *
 * A total table rather than a `switch`, and keyed by plain `string` rather than
 * by `MazeGlyph`, because that is precisely what makes the legend a CLOSED set:
 * a lookup of an unknown character yields `undefined` under
 * `noUncheckedIndexedAccess`, and `undefined` is the signal `parseMaze` turns
 * into a loud failure. A `switch` with a `default` would quietly absorb a typo
 * as open floor, which is a hole in a wall discovered by a player.
 *
 * Note that food and markers are not their own terrain: a dot sits ON open
 * floor, and the three house markers sit ON house floor. Where an actor may
 * walk is a question about the board, never about what happens to be lying on
 * it.
 */
const GLYPH_KINDS: Readonly<Record<string, TileKind>> = {
  [MazeGlyph.Wall]: TileKind.Wall,
  [MazeGlyph.Empty]: TileKind.Open,
  [MazeGlyph.Door]: TileKind.Door,
  [MazeGlyph.Tunnel]: TileKind.Tunnel,
  [MazeGlyph.House]: TileKind.House,
  [MazeGlyph.Pellet]: TileKind.Open,
  [MazeGlyph.PowerPellet]: TileKind.Open,
  [MazeGlyph.PacmanSpawn]: TileKind.Open,
  [MazeGlyph.BlinkySpawn]: TileKind.Open,
  [MazeGlyph.PinkySpawn]: TileKind.House,
  [MazeGlyph.InkySpawn]: TileKind.House,
  [MazeGlyph.ClydeSpawn]: TileKind.House,
  [MazeGlyph.FruitTile]: TileKind.Open,
};

/**
 * Which ghost a spawn marker names.
 *
 * Separate from `GLYPH_KINDS` because the two answer different questions —
 * "what may walk here" versus "who starts here" — and folding them into one
 * table would force every terrain lookup to carry a ghost-shaped hole.
 */
const GHOST_SPAWN_GLYPHS: Readonly<Record<string, GhostId>> = {
  [MazeGlyph.BlinkySpawn]: GhostId.Blinky,
  [MazeGlyph.PinkySpawn]: GhostId.Pinky,
  [MazeGlyph.InkySpawn]: GhostId.Inky,
  [MazeGlyph.ClydeSpawn]: GhostId.Clyde,
};

/** The inverse of `GHOST_SPAWN_GLYPHS`, for the round trip back to ASCII. */
const GHOST_SPAWN_MARKS: Readonly<Record<GhostId, string>> = {
  [GhostId.Blinky]: MazeGlyph.BlinkySpawn,
  [GhostId.Pinky]: MazeGlyph.PinkySpawn,
  [GhostId.Inky]: MazeGlyph.InkySpawn,
  [GhostId.Clyde]: MazeGlyph.ClydeSpawn,
};

/**
 * The inverse of `GLYPH_KINDS`, and deliberately not derivable from it.
 *
 * Five kinds map back to five characters, while thirteen characters map forward
 * to five kinds — the forward table is many-to-one, so it cannot be inverted.
 * The information the render side needs to put a dot back is in `pelletTiles`,
 * not in the terrain.
 */
const KIND_GLYPHS: Readonly<Record<TileKind, string>> = {
  [TileKind.Wall]: MazeGlyph.Wall,
  [TileKind.Open]: MazeGlyph.Empty,
  [TileKind.Door]: MazeGlyph.Door,
  [TileKind.Tunnel]: MazeGlyph.Tunnel,
  [TileKind.House]: MazeGlyph.House,
};

/** The flat, row-major index of a tile — the one place the arithmetic is written. */
function indexOf(maze: Maze, tile: Tile): number {
  return tile.row * maze.columns + tile.col;
}

/**
 * Turns authored ASCII into a `Maze`, or throws.
 *
 * It never returns a half-built board: authored data is validated once, at
 * construction, exactly as `validateSprite` validates a sprite and `load-atlas`
 * validates a manifest. Everything downstream may then treat every field as
 * present, which is why `Maze` has no optional properties at all.
 *
 * VALIDATION ORDER, because the error message a human sees depends on it:
 *
 *   1. SHAPE   — row 0 declares the width; any later row of a different length
 *                throws, naming the row index and both widths.
 *   2. GLYPHS  — any character outside `MazeGlyph` throws, naming the row, the
 *                column and the offending character.
 *   3. DOOR    — a board with no `-` throws. A maze without a gate can never
 *                release a ghost, and a door silently defaulted to (0,0) puts
 *                every ghost's exit target in a corner wall.
 *   4. SPAWN   — a board with no `P` throws, for the same reason: `startGame`
 *                places Pac-Man there with no fallback.
 *
 * All indices in every message are ZERO-BASED, matching `Tile.col`/`Tile.row`,
 * so a reported coordinate can be pasted straight into a test. A message that
 * names neither the row nor the character is a message that sends a human back
 * to counting 868 characters by hand.
 *
 * DELIBERATE DEFAULTS, so a five-by-five fixture stays readable. Absent markers
 * do not throw:
 *
 *   - a ghost spawn `1`..`4` falls back to `houseCentreTile`
 *   - `F` falls back to `pacmanSpawn`
 *   - no `T` anywhere means `tunnelRow` is -1 and `wrapPosition` never warps
 *   - `houseDoorTile` is the FIRST `-` in row-major order
 *   - `houseCentreTile` is the floor-midpoint of the bounding box of the house
 *     tiles
 *   - `scatterTargets` are the board's four outside corners, derived from
 *     `columns` and `rows`: Blinky (columns-3, 0), Pinky (2, 0),
 *     Inky (columns-1, rows-1), Clyde (0, rows-1)
 *   - `noUpTiles` is EMPTY. The four arcade no-up tiles are a ROM quirk with
 *     nothing in the ASCII to derive them from, so they are authored beside the
 *     board in `classic-layout.ts` and applied in `arcade-maze.ts`. Deriving
 *     them here would plant phantom no-up tiles on every hand-drawn fixture.
 *
 * Only the two fields whose absence would break the game outright — the gate a
 * ghost leaves by, and the tile Pac-Man starts on — are required.
 *
 * NOTE, against docs/ARCHITECTURE.md: that document also lists "the wrong
 * pellet counts" as a parse failure. It cannot be, or every three-by-three
 * fixture would be rejected. The 240/4 census belongs to the authored board,
 * not to the parser, and it is pinned by `classic-layout.test.ts` and by the
 * flood fill in `arcade-maze.test.ts`. Recorded here as a decision rather than
 * left as an omission.
 *
 * SECOND NOTE, for a reader auditing the branches: there is no "board with no
 * house" fallback for `houseCentreTile`. Every layout in the repository draws a
 * house, so such a branch could never be reached by a test, and an unreachable
 * defensive branch is worse than none — it is untested code wearing the costume
 * of safety.
 */
export function parseMaze(rows: readonly string[]): Maze {
  let columns = 0;
  for (const [index, row] of rows.entries()) {
    if (index === 0) {
      columns = row.length;
    } else if (row.length !== columns) {
      throw new Error(
        `maze row ${String(index)} has ${String(row.length)} columns, expected ${String(columns)}`,
      );
    }
  }

  const tiles: TileKind[] = [];
  const pelletTiles: Tile[] = [];
  const powerPelletTiles: Tile[] = [];
  const ghostMarks = new Map<GhostId, Tile>();
  let houseDoorTile: Tile | null = null;
  let pacmanSpawn: Tile | null = null;
  let fruitMark: Tile | null = null;
  let tunnelRow = -1;

  /* The house bounding box, seeded so that it collapses without any branch on
     "have we seen a house tile yet". */
  let houseMinCol = columns;
  let houseMaxCol = -1;
  let houseMinRow = rows.length;
  let houseMaxRow = -1;

  for (const [row, line] of rows.entries()) {
    /* charAt with an index loop, never a spread: spreading a string iterates
       code POINTS, which are not its indices, and `no-misused-spread` is an
       eslint error here for exactly that reason. */
    for (let col = 0; col < line.length; col += 1) {
      const glyph = line.charAt(col);
      const kind = GLYPH_KINDS[glyph];
      if (kind === undefined) {
        throw new Error(`maze row ${String(row)}, column ${String(col)}: unknown glyph '${glyph}'`);
      }

      const tile: Tile = { col, row };
      tiles.push(kind);

      if (kind === TileKind.Door && houseDoorTile === null) {
        houseDoorTile = tile;
      }
      if (kind === TileKind.Tunnel) {
        tunnelRow = row;
      }
      if (kind === TileKind.House) {
        houseMinCol = Math.min(houseMinCol, col);
        houseMaxCol = Math.max(houseMaxCol, col);
        houseMinRow = Math.min(houseMinRow, row);
        houseMaxRow = Math.max(houseMaxRow, row);
      }
      if (glyph === MazeGlyph.Pellet) {
        pelletTiles.push(tile);
      }
      if (glyph === MazeGlyph.PowerPellet) {
        powerPelletTiles.push(tile);
      }
      if (glyph === MazeGlyph.PacmanSpawn) {
        pacmanSpawn = tile;
      }
      if (glyph === MazeGlyph.FruitTile) {
        fruitMark = tile;
      }
      const ghost = GHOST_SPAWN_GLYPHS[glyph];
      if (ghost !== undefined) {
        ghostMarks.set(ghost, tile);
      }
    }
  }

  if (houseDoorTile === null) {
    throw new Error(`maze has no ghost-house door: expected at least one '${MazeGlyph.Door}' tile`);
  }
  if (pacmanSpawn === null) {
    throw new Error(
      `maze has no Pac-Man spawn: expected exactly one '${MazeGlyph.PacmanSpawn}' tile`,
    );
  }

  const houseCentreTile: Tile = {
    col: Math.floor((houseMinCol + houseMaxCol) / 2),
    row: Math.floor((houseMinRow + houseMaxRow) / 2),
  };

  return {
    columns,
    rows: rows.length,
    tiles,
    pelletTiles,
    powerPelletTiles,
    noUpTiles: new Set<number>(),
    pacmanSpawn,
    ghostSpawns: {
      [GhostId.Blinky]: ghostMarks.get(GhostId.Blinky) ?? houseCentreTile,
      [GhostId.Pinky]: ghostMarks.get(GhostId.Pinky) ?? houseCentreTile,
      [GhostId.Inky]: ghostMarks.get(GhostId.Inky) ?? houseCentreTile,
      [GhostId.Clyde]: ghostMarks.get(GhostId.Clyde) ?? houseCentreTile,
    },
    scatterTargets: {
      [GhostId.Blinky]: { col: columns - 3, row: 0 },
      [GhostId.Pinky]: { col: 2, row: 0 },
      [GhostId.Inky]: { col: columns - 1, row: rows.length - 1 },
      [GhostId.Clyde]: { col: 0, row: rows.length - 1 },
    },
    houseDoorTile,
    houseCentreTile,
    fruitTile: fruitMark ?? pacmanSpawn,
    tunnelRow,
  };
}

/**
 * The single glyph that stands for one tile, by first-match precedence.
 *
 * Precedence exists at all because several facts can be true of the same tile —
 * Pinky's spawn is also house floor — and ASCII has room for exactly one
 * character. Markers win over food, and food wins over terrain, because a
 * marker and a dot never share a tile on a real board while a marker and its
 * floor always do.
 */
function glyphAt(
  maze: Maze,
  tile: Tile,
  pellets: ReadonlySet<number>,
  powerPellets: ReadonlySet<number>,
): string {
  if (tileEquals(tile, maze.pacmanSpawn)) {
    return MazeGlyph.PacmanSpawn;
  }
  for (const id of GHOST_ORDER) {
    if (tileEquals(tile, maze.ghostSpawns[id])) {
      return GHOST_SPAWN_MARKS[id];
    }
  }
  if (tileEquals(tile, maze.fruitTile)) {
    return MazeGlyph.FruitTile;
  }
  const index = indexOf(maze, tile);
  if (powerPellets.has(index)) {
    return MazeGlyph.PowerPellet;
  }
  if (pellets.has(index)) {
    return MazeGlyph.Pellet;
  }
  return KIND_GLYPHS[kindAt(maze, tile)];
}

/**
 * The inverse of `parseMaze`: a `Maze` rendered back to the ASCII it came from.
 *
 * This exists so the parser can be checked by a ROUND TRIP rather than by a
 * snapshot. A snapshot of the tile grid would have no oracle at all — whatever
 * the parser produced on day one would become the expected value forever, and a
 * reader could never check it. Here the authored layout IS the oracle, and a
 * failure prints two blocks of ASCII a human can read side by side.
 *
 * `houseDoorTile` and `houseCentreTile` need no glyph of their own: the gate is
 * recovered from its `Door` kind, and the house centre is Pinky's spawn.
 */
export function renderMaze(maze: Maze): readonly string[] {
  const pellets = new Set(maze.pelletTiles.map((tile) => indexOf(maze, tile)));
  const powerPellets = new Set(maze.powerPelletTiles.map((tile) => indexOf(maze, tile)));

  const lines: string[] = [];
  for (let row = 0; row < maze.rows; row += 1) {
    let line = '';
    for (let col = 0; col < maze.columns; col += 1) {
      line += glyphAt(maze, { col, row }, pellets, powerPellets);
    }
    lines.push(line);
  }
  return lines;
}
