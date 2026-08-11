import { type Actor } from '../core/actor/actor.ts';
import { type GameState } from '../core/game/game-state.ts';
import { TILE_SIZE } from '../core/geometry/tile.ts';
import { GHOST_ORDER } from '../core/ghost/ghost-id.ts';
import { type PelletField } from '../core/maze/pellets.ts';

import { type Scene } from './draw-surface.ts';

interface Sprite {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Places a sprite at an actor's pixel position.
 *
 * Actors already carry pixel coordinates, so this is only a rename — but it is
 * the rename that stops the two coordinate spaces being mixed up at the call
 * site, which is the same reason `Tile` is not `Vector2`.
 */
function atActor(name: string, actor: Actor): Sprite {
  return { name, x: actor.position.x, y: actor.position.y };
}

/**
 * Expands a set of flat tile indices into sprites.
 *
 * The pellet field stores row-major indices rather than tiles, because
 * membership tests happen every frame and a Set of numbers is the cheapest way
 * to ask. Unpacking is therefore a rendering concern and lives here.
 */
function fromTileIndices(name: string, indices: ReadonlySet<number>, columns: number): Sprite[] {
  return [...indices].map((index) => ({
    name,
    x: (index % columns) * TILE_SIZE,
    y: Math.floor(index / columns) * TILE_SIZE,
  }));
}

function pelletSprites(field: PelletField): Sprite[] {
  return [
    ...fromTileIndices('pellet', field.pellets, field.columns),
    ...fromTileIndices('power-pellet', field.powerPellets, field.columns),
  ];
}

function ghostSprites(state: GameState): Sprite[] {
  return GHOST_ORDER.map((id) =>
    atActor(`${id}-${state.ghosts[id].actor.facing}-1`, state.ghosts[id].actor),
  );
}

/**
 * Turns a game state into the sprites to draw.
 *
 * Array order is z-order (see `renderScene`), so the sequence here is the
 * drawing order: dots underneath, then Pac-Man, then ghosts on top — because a
 * ghost overlapping Pac-Man is the moment the player most needs to see clearly.
 */
export function buildScene(state: GameState): Scene {
  return {
    sprites: [
      ...pelletSprites(state.pellets),
      atActor(`pacman-${state.pacman.actor.facing}-open`, state.pacman.actor),
      ...ghostSprites(state),
    ],
  };
}
