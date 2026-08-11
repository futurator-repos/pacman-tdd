import { type Palette, type SpriteSource } from './sprite-source.ts';

/**
 * The arcade palette. These are the original machine's colours, not
 * approximations — pinned by a test so a future tweak has to be deliberate.
 */
export const ARCADE_PALETTE = {
  PACMAN: '#ffff00',
  BLINKY: '#ff0000',
  PINKY: '#ffb8ff',
  INKY: '#00ffff',
  CLYDE: '#ffb852',
  MAZE_BLUE: '#2121ff',
  PELLET: '#ffb897',
} as const;

const YELLOW: Palette = { _: null, Y: ARCADE_PALETTE.PACMAN };
const PELLET: Palette = { _: null, P: ARCADE_PALETTE.PELLET };

/**
 * Pac-Man facing right, mouth fully open.
 *
 * A disc with a wedge removed. The wedge widens toward the facing edge, which
 * is what reads as a mouth at 16x16. Rows 7 and 8 are cut back to the centre
 * column, so the apex sits at the sprite's middle.
 */
const pacmanRightOpen: SpriteSource = {
  name: 'pacman-right-open',
  palette: YELLOW,
  pixels: [
    '_____YYYYYY_____',
    '___YYYYYYYYYY___',
    '__YYYYYYYYYYYY__',
    '_YYYYYYYYYYYYYY_',
    '_YYYYYYYYYYYYY__',
    'YYYYYYYYYYYY____',
    'YYYYYYYYYY______',
    'YYYYYYYY________',
    'YYYYYYYY________',
    'YYYYYYYYYY______',
    'YYYYYYYYYYYY____',
    '_YYYYYYYYYYYYY__',
    '_YYYYYYYYYYYYYY_',
    '__YYYYYYYYYYYY__',
    '___YYYYYYYYYY___',
    '_____YYYYYY_____',
  ],
};

/** Pac-Man facing right, mouth half open — the middle animation frame. */
const pacmanRightHalf: SpriteSource = {
  name: 'pacman-right-half',
  palette: YELLOW,
  pixels: [
    '_____YYYYYY_____',
    '___YYYYYYYYYY___',
    '__YYYYYYYYYYYY__',
    '_YYYYYYYYYYYYYY_',
    '_YYYYYYYYYYYYYY_',
    'YYYYYYYYYYYYYY__',
    'YYYYYYYYYYYY____',
    'YYYYYYYYYY______',
    'YYYYYYYYYY______',
    'YYYYYYYYYYYY____',
    'YYYYYYYYYYYYYY__',
    '_YYYYYYYYYYYYYY_',
    '_YYYYYYYYYYYYYY_',
    '__YYYYYYYYYYYY__',
    '___YYYYYYYYYY___',
    '_____YYYYYY_____',
  ],
};

/** Pac-Man with his mouth shut — a plain disc, used between mouth frames. */
const pacmanClosed: SpriteSource = {
  name: 'pacman-closed',
  palette: YELLOW,
  pixels: [
    '_____YYYYYY_____',
    '___YYYYYYYYYY___',
    '__YYYYYYYYYYYY__',
    '_YYYYYYYYYYYYYY_',
    '_YYYYYYYYYYYYYY_',
    'YYYYYYYYYYYYYYYY',
    'YYYYYYYYYYYYYYYY',
    'YYYYYYYYYYYYYYYY',
    'YYYYYYYYYYYYYYYY',
    'YYYYYYYYYYYYYYYY',
    'YYYYYYYYYYYYYYYY',
    '_YYYYYYYYYYYYYY_',
    '_YYYYYYYYYYYYYY_',
    '__YYYYYYYYYYYY__',
    '___YYYYYYYYYY___',
    '_____YYYYYY_____',
  ],
};

/** A plain pellet: a 2x2 dot centred in an otherwise empty cell. */
const pellet: SpriteSource = {
  name: 'pellet',
  palette: PELLET,
  pixels: [
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '_______PP_______',
    '_______PP_______',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
  ],
};

/** Every sprite that goes into the atlas. */
export const SPRITES: readonly SpriteSource[] = [
  pacmanRightOpen,
  pacmanRightHalf,
  pacmanClosed,
  pellet,
];

/* STUB - see docs/TDD-CHARTER.md, Challenge 1. */
export const GHOST_COLOURS: Readonly<Record<string, string>> = {};

export function spriteNamed(_name: string): SpriteSource | undefined {
  return undefined;
}
