import { describe, expect, it } from 'vitest';

import { buildState } from '../core/testing/state-builder.ts';

import { buildScene } from './build-scene.ts';

/**
 * Turns a GameState into the list of sprites to draw.
 *
 * This is the last pure step before pixels: it reads state and returns data,
 * so it can be tested by value with no canvas and no browser.
 */
describe('buildScene', () => {
  it('draws pac-man at his pixel position', () => {
    const state = buildState({ pacman: { actor: { position: { x: 40, y: 72 } } } });

    const scene = buildScene(state);

    expect(scene.sprites).toContainEqual(expect.objectContaining({ x: 40, y: 72 }));
  });
  it('faces pac-man in the direction he is travelling', () => {
    const state = buildState({ pacman: { actor: { facing: 'up' } } });

    const scene = buildScene(state);

    expect(scene.sprites.map((sprite) => sprite.name)).toContain('pacman-up-open');
  });
  it('draws a pellet at each remaining dot', () => {
    const state = buildState();

    const scene = buildScene(state);

    const pellets = scene.sprites.filter((sprite) => sprite.name === 'pellet');
    /* The arcade board holds 240 dots. If this drew none, or drew the eaten
       ones too, the maze would look empty or never empty. */
    expect(pellets).toHaveLength(240);
  });
  it('draws all four ghosts, each in its own colour', () => {
    const state = buildState();

    const names = buildScene(state).sprites.map((sprite) => sprite.name);

    /* Four separate assertions rather than a count: a scene with four Blinkys
       would satisfy a count and be very wrong. */
    expect(names.some((name) => name.startsWith('blinky-'))).toBe(true);
    expect(names.some((name) => name.startsWith('pinky-'))).toBe(true);
    expect(names.some((name) => name.startsWith('inky-'))).toBe(true);
    expect(names.some((name) => name.startsWith('clyde-'))).toBe(true);
  });
  it('draws the four power pellets, distinct from ordinary dots', () => {
    const state = buildState();

    const names = buildScene(state).sprites.map((sprite) => sprite.name);

    /* Four, and drawn with a different sprite: a power pellet rendered as an
       ordinary dot gives the player no way to see the one thing that turns the
       game around. */
    expect(names.filter((name) => name === 'power-pellet')).toHaveLength(4);
  });
});
