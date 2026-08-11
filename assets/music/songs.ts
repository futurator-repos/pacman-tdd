import { AudioCue } from '../../src/core/audio/audio-cue.ts';

import { type Note, type Song } from './note.ts';

/**
 * Every tune in the game, authored as note data.
 *
 * Pitches are MIDI note numbers, so a rising line reads as rising numbers and
 * transposing is addition. Durations are in sixteenth notes.
 *
 * These are recognisable arrangements rather than ROM transcriptions: the
 * arcade's audio came from three hardware voices with waveform tables, which a
 * single oscillator cannot reproduce exactly. Shapes, intervals and timings
 * follow the original; the exact timbre does not, and that is recorded here
 * rather than claimed as fidelity.
 */

/* Note names, so the tunes below read as music instead of as arithmetic. */
const C4 = 60;
const D4 = 62;
const E4 = 64;
const F4 = 65;
const G4 = 67;
const A4 = 69;
const B4 = 71;
const C5 = 72;
const D5 = 74;
const E5 = 76;
const F5 = 77;
const G5 = 79;
const A5 = 81;
const B5 = 83;
const C6 = 84;
const C3 = 48;
const G3 = 55;
const A3 = 57;
const E3 = 52;

const n = (pitch: number | null, duration: number): Note => ({ pitch, duration });

/**
 * The opening fanfare.
 *
 * The famous rising-then-falling arpeggio figure, played twice at different
 * octaves. Roughly four seconds, which is what the "real melody rather than a
 * placeholder" test is protecting: every other check here passes for a
 * one-note intro.
 */
const intro: Song = {
  name: 'intro',
  tempo: 200,
  loop: false,
  notes: [
    n(C5, 1),
    n(C6, 1),
    n(G5, 1),
    n(E5, 1),
    n(C6, 1),
    n(G5, 2),
    n(E5, 2),
    n(C5, 1),
    n(D5, 1),
    n(B4, 1),
    n(null, 1),
    n(D5, 1),
    n(B4, 2),
    n(null, 2),
    n(C5, 1),
    n(D5, 1),
    n(E5, 1),
    n(F5, 1),
    n(G5, 1),
    n(A5, 1),
    n(B5, 2),
    n(C6, 4),
  ],
};

/**
 * The looping background siren.
 *
 * A two-note oscillation. Short and looping rather than a melody, because it
 * plays underneath everything for a whole round and anything more would become
 * exhausting.
 */
const siren: Song = {
  name: 'siren',
  tempo: 140,
  loop: true,
  notes: [n(A3, 2), n(C4, 2), n(A3, 2), n(G3, 2)],
};

/** The frightened warble: faster and lower, so the change of state is audible
 *  even when the player is looking at the other side of the maze. */
const frightened: Song = {
  name: 'frightened',
  tempo: 220,
  loop: true,
  notes: [n(E3, 1), n(A3, 1), n(E3, 1), n(C4, 1)],
};

/** Eyes returning home: a fast high shuttle, deliberately unlike the siren. */
const retreating: Song = {
  name: 'retreating',
  tempo: 260,
  loop: true,
  notes: [n(C5, 1), n(G5, 1), n(E5, 1), n(G5, 1)],
};

/**
 * One bite.
 *
 * Two sixteenths at 400 BPM: about 75ms, comfortably inside the ~130ms gap
 * between dots at full speed. A longer chomp overlaps itself into a drone,
 * which is what its duration test protects.
 */
const chomp: Song = {
  name: 'chomp',
  tempo: 400,
  loop: false,
  notes: [n(C4, 1), n(G3, 1)],
};

/** Eating a ghost: a rising sweep, the reward sound. */
const ghostEaten: Song = {
  name: 'ghostEaten',
  tempo: 300,
  loop: false,
  notes: [n(C4, 1), n(E4, 1), n(G4, 1), n(C5, 1), n(E5, 1), n(G5, 2)],
};

/** Eating fruit: shorter and brighter than the ghost sweep, so the two are
 *  distinguishable without looking. */
const fruitEaten: Song = {
  name: 'fruitEaten',
  tempo: 300,
  loop: false,
  notes: [n(E5, 1), n(G5, 1), n(C6, 2)],
};

/**
 * The death jingle.
 *
 * A descending chromatic collapse. Kept under three seconds because the death
 * animation is 180 frames (docs/ARCADE-REFERENCE.md section 7) and a jingle
 * outlasting its animation plays over the next round.
 */
const death: Song = {
  name: 'death',
  tempo: 180,
  loop: false,
  notes: [
    n(C5, 1),
    n(B4, 1),
    n(A4, 1),
    n(G4, 1),
    n(F4, 1),
    n(E4, 1),
    n(D4, 1),
    n(C4, 1),
    n(B4 - 12, 1),
    n(A4 - 12, 1),
    n(G3, 1),
    n(C3, 3),
  ],
};

/** The extra life at 10000 points: a short bright flourish. */
const extraLife: Song = {
  name: 'extraLife',
  tempo: 320,
  loop: false,
  notes: [n(C5, 1), n(E5, 1), n(G5, 1), n(C6, 2)],
};

/**
 * The table the synthesiser plays from.
 *
 * Typed as a total record over `AudioCue`, so a new cue without a tune fails
 * to compile. The completeness test still reads the runtime keys, because a
 * type is a claim and the test's job is to measure.
 */
export const SONGS: Readonly<Record<AudioCue, Song>> = {
  [AudioCue.Intro]: intro,
  [AudioCue.Siren]: siren,
  [AudioCue.Frightened]: frightened,
  [AudioCue.Retreating]: retreating,
  [AudioCue.Chomp]: chomp,
  [AudioCue.GhostEaten]: ghostEaten,
  [AudioCue.FruitEaten]: fruitEaten,
  [AudioCue.Death]: death,
  [AudioCue.ExtraLife]: extraLife,
};
