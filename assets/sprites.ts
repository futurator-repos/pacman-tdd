import { type Palette, type SpriteSource } from './sprite-source.ts';
import { mirrorHorizontal, recolour, rotateClockwise } from './transform.ts';

/**
 * The complete arcade sprite roster.
 *
 * 52 sprites, but only 20 are authored by hand. The rest are derived: Pac-Man's
 * four facings come from rotating and mirroring one right-facing shape, and 32
 * ghost frames come from recolouring 8 base bodies. That is what keeps the art
 * reviewable — a change to the ghost shape is one edit, not thirty-two.
 */

/** The original machine's colours. Pinned by a test so a tweak stays deliberate. */
export const ARCADE_PALETTE = {
  PACMAN: '#ffff00',
  BLINKY: '#ff0000',
  PINKY: '#ffb8ff',
  INKY: '#00ffff',
  CLYDE: '#ffb852',
  MAZE_BLUE: '#2121ff',
  PELLET: '#ffb897',
  FRIGHTENED: '#2121ff',
  FLASHING: '#ffffff',
  EYE_WHITE: '#ffffff',
  PUPIL: '#2121ff',
  CHERRY: '#ff0000',
  STEM: '#00ff00',
} as const;

/**
 * The four ghosts and their body colours, in arcade order.
 *
 * This table drives the derivation: one entry here produces eight sprites.
 * A test asserts the roster contains exactly one ghost per entry, so adding a
 * fifth ghost cannot silently fail to appear.
 */
export const GHOST_COLOURS = {
  blinky: ARCADE_PALETTE.BLINKY,
  pinky: ARCADE_PALETTE.PINKY,
  inky: ARCADE_PALETTE.INKY,
  clyde: ARCADE_PALETTE.CLYDE,
} as const;

const YELLOW: Palette = { _: null, Y: ARCADE_PALETTE.PACMAN };
const PELLET_PALETTE: Palette = { _: null, P: ARCADE_PALETTE.PELLET };
const EYE_PALETTE: Palette = { _: null, W: ARCADE_PALETTE.EYE_WHITE, P: ARCADE_PALETTE.PUPIL };
const CHERRY_PALETTE: Palette = {
  _: null,
  C: ARCADE_PALETTE.CHERRY,
  S: ARCADE_PALETTE.STEM,
};

/**
 * Ghost palette. 'B' is the body and is the only key a recolour touches — the
 * eyes stay white and the pupils stay blue for every ghost, exactly as in the
 * arcade.
 */
const GHOST_PALETTE: Palette = {
  _: null,
  B: ARCADE_PALETTE.BLINKY,
  W: ARCADE_PALETTE.EYE_WHITE,
  P: ARCADE_PALETTE.PUPIL,
};

const FRIGHTENED_PALETTE: Palette = {
  _: null,
  B: ARCADE_PALETTE.FRIGHTENED,
  W: ARCADE_PALETTE.EYE_WHITE,
};

/* ------------------------------------------------------------------ */
/* Pac-Man — one authored facing, three derived                        */
/* ------------------------------------------------------------------ */

/** A disc with a wedge removed. The wedge widens toward the facing edge. */
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

/** Mouth shut: a plain disc, so one sprite serves all four directions. */
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

/**
 * Derives the other three facings.
 *
 * Left is a MIRROR, not two rotations: reflecting and rotating differ for any
 * shape that is not symmetric about both axes, and using the wrong one is the
 * classic way a sprite ends up subtly upside down.
 *
 * Down is one clockwise turn (a right-pointing mouth turns to point down), and
 * up is three.
 */
function pacmanFacings(base: SpriteSource, mouth: string): readonly SpriteSource[] {
  return [
    { ...base, name: `pacman-right-${mouth}` },
    rotateClockwise(base, `pacman-down-${mouth}`),
    mirrorHorizontal(base, `pacman-left-${mouth}`),
    rotateClockwise(rotateClockwise(rotateClockwise(base)), `pacman-up-${mouth}`),
  ];
}

/* ------------------------------------------------------------------ */
/* Ghosts — 8 authored bodies, 32 derived                              */
/* ------------------------------------------------------------------ */

/**
 * A ghost body.
 *
 * Ghosts never rotate: the dome always faces up and only the eyes move, which
 * is why these four facings are authored rather than derived. `skirt` supplies
 * the wavy bottom edge, which alternates between the two animation frames.
 */
function ghostBody(eyeRows: readonly string[], skirt: string): readonly string[] {
  return [
    '______BBBB______',
    '____BBBBBBBB____',
    '___BBBBBBBBBB___',
    '__BBBBBBBBBBBB__',
    ...eyeRows,
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    skirt,
  ];
}

/** Pupils sit on the side of the eye the ghost is looking toward. */
const EYES_BY_DIRECTION = {
  right: ['_BBWWWBBBWWWBBB_', '_BBWPPBBBWPPBBB_', 'BBBWPPBBBWPPBBBB', 'BBBWWWBBBWWWBBBB'],
  left: ['_BBWWWBBBWWWBBB_', '_BBPPWBBBPPWBBB_', 'BBBPPWBBBPPWBBBB', 'BBBWWWBBBWWWBBBB'],
  up: ['_BBWPPBBBWPPBBB_', '_BBWPPBBBWPPBBB_', 'BBBWWWBBBWWWBBBB', 'BBBWWWBBBWWWBBBB'],
  down: ['_BBWWWBBBWWWBBB_', '_BBWWWBBBWWWBBB_', 'BBBWPPBBBWPPBBBB', 'BBBWPPBBBWPPBBBB'],
} as const;

const SKIRTS = ['BB__BB__BB__BB__', '_BB__BB__BB__BB_'] as const;

const GHOST_DIRECTIONS = ['right', 'down', 'left', 'up'] as const;

/** The 8 base bodies: four facings, two animation frames each. */
const ghostBases: readonly SpriteSource[] = GHOST_DIRECTIONS.flatMap((direction) =>
  SKIRTS.map((skirt, index) => ({
    name: `ghost-${direction}-${String(index + 1)}`,
    palette: GHOST_PALETTE,
    pixels: ghostBody(EYES_BY_DIRECTION[direction], skirt),
  })),
);

/** One table entry becomes eight sprites: only the body colour changes. */
const ghostSprites: readonly SpriteSource[] = Object.entries(GHOST_COLOURS).flatMap(
  ([ghost, colour]) =>
    ghostBases.map((base) => recolour(base, base.name.replace('ghost', ghost), { B: colour })),
);

/* ------------------------------------------------------------------ */
/* Frightened, flashing, eyes and items                                */
/* ------------------------------------------------------------------ */

/** Blue, with a zigzag mouth and small dot eyes. */
function frightenedBody(skirt: string): readonly string[] {
  return [
    '______BBBB______',
    '____BBBBBBBB____',
    '___BBBBBBBBBB___',
    '__BBBBBBBBBBBB__',
    '_BBWWBBBBBBWWBB_',
    '_BBWWBBBBBBWWBB_',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'BBWBBWBBWBBWBBWB',
    'BWBBWBBWBBWBBWBB',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    skirt,
  ];
}

const frightenedSprites: readonly SpriteSource[] = SKIRTS.map((skirt, index) => ({
  name: `frightened-${String(index + 1)}`,
  palette: FRIGHTENED_PALETTE,
  pixels: frightenedBody(skirt),
}));

/**
 * The white warning frames shown as a power pellet expires.
 *
 * Derived by swapping the two colours of the frightened sprite, so the shapes
 * can never drift apart.
 */
const flashingSprites: readonly SpriteSource[] = frightenedSprites.map((sprite, index) =>
  recolour(sprite, `flashing-${String(index + 1)}`, {
    B: ARCADE_PALETTE.FLASHING,
    W: ARCADE_PALETTE.FRIGHTENED,
  }),
);

/** Eyes alone: what remains of a ghost that has been eaten. */
const eyeSprites: readonly SpriteSource[] = GHOST_DIRECTIONS.map((direction) => ({
  name: `eyes-${direction}`,
  palette: EYE_PALETTE,
  pixels: [
    '________________',
    '________________',
    '________________',
    '________________',
    ...EYES_BY_DIRECTION[direction].map((row) =>
      /* Strip the body, keeping only the eyes. */
      Array.from({ length: row.length }, (_unused, i) => {
        const char = row.charAt(i);
        return char === 'W' || char === 'P' ? char : '_';
      }).join(''),
    ),
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
  ],
}));

const pellet: SpriteSource = {
  name: 'pellet',
  palette: PELLET_PALETTE,
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

const powerPellet: SpriteSource = {
  name: 'power-pellet',
  palette: PELLET_PALETTE,
  pixels: [
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
    '_____PPPPPP_____',
    '____PPPPPPPP____',
    '____PPPPPPPP____',
    '____PPPPPPPP____',
    '____PPPPPPPP____',
    '_____PPPPPP_____',
    '________________',
    '________________',
    '________________',
    '________________',
    '________________',
  ],
};

const cherry: SpriteSource = {
  name: 'cherry',
  palette: CHERRY_PALETTE,
  pixels: [
    '________________',
    '____________SS__',
    '___________SS___',
    '__________SS____',
    '_______SSSS_____',
    '_____SS____SS___',
    '____S________S__',
    '___CCC____CCC___',
    '__CCCCC__CCCCC__',
    '__CCCCC__CCCCC__',
    '__CCCCC__CCCCC__',
    '___CCC____CCC___',
    '________________',
    '________________',
    '________________',
    '________________',
  ],
};

/* ------------------------------------------------------------------ */

/** Every sprite that goes into the atlas: 20 authored, 32 derived. */
export const SPRITES: readonly SpriteSource[] = [
  ...pacmanFacings(pacmanRightOpen, 'open'),
  ...pacmanFacings(pacmanRightHalf, 'half'),
  pacmanClosed,
  ...ghostSprites,
  ...frightenedSprites,
  ...flashingSprites,
  ...eyeSprites,
  pellet,
  powerPellet,
  cherry,
];

const BY_NAME = new Map(SPRITES.map((sprite) => [sprite.name, sprite]));

/** Looks up a sprite by name, or `undefined` if the roster has no such sprite. */
export function spriteNamed(name: string): SpriteSource | undefined {
  return BY_NAME.get(name);
}
