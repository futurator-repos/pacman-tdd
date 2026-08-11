/**
 * Music authored as data, exactly as the sprites are.
 *
 * The arcade's sound is a handful of short square-wave tunes. Rather than ship
 * binary audio files — which nobody can review, diff, or check into a test —
 * the tunes are written here as note data and synthesised at runtime. A change
 * to the death jingle shows up in a pull request as changed notes.
 *
 * This mirrors `assets/sprite-source.ts` deliberately: same idea, same payoff.
 * Note data is inert, so it can be validated by a unit test with no audio
 * hardware, no Web Audio context, and no listening.
 */

/**
 * MIDI note number. Middle C is 60, and each step is one semitone.
 *
 * MIDI numbers rather than frequencies because they are readable — 60, 62, 64
 * is a rising scale at a glance, where 261.63, 293.66, 329.63 is not — and
 * because transposing a tune becomes addition. The conversion to hertz is one
 * documented formula, tested in isolation.
 */
export type MidiNote = number;

/* Not exported: only `Note.pitch` names it, and knip counts an unimported
   export as dead weight. `null` rather than a magic note number, so silence is
   unrepresentable as a pitch and cannot be played by accident. */
type Rest = null;

export interface Note {
  /** The pitch, or `null` for a rest. */
  readonly pitch: MidiNote | Rest;
  /** Length in sixteenth notes. 4 is a quarter note. */
  readonly duration: number;
}

/**
 * A complete tune.
 *
 * `tempo` is in beats per minute, where a beat is a quarter note. `loop` marks
 * the tunes that continue until something stops them — the siren that plays
 * for the whole round — as opposed to the one-shot jingles.
 */
export interface Song {
  readonly name: string;
  readonly tempo: number;
  readonly loop: boolean;
  readonly notes: readonly Note[];
}

/** Concert A, the anchor of the standard tuning. */
const A4_MIDI = 69;
const A4_HZ = 440;
const SEMITONES_PER_OCTAVE = 12;

/**
 * Converts a MIDI note number to its frequency in hertz.
 *
 * The standard equal-temperament formula: every semitone multiplies the
 * frequency by the twelfth root of two, anchored at A4 = 440Hz = note 69.
 *
 * Kept in `assets/` beside the note data rather than in the synthesiser,
 * because it is a fact about music notation rather than about Web Audio — and
 * keeping it here means it can be unit-tested without an audio context.
 */
export function midiToFrequency(note: MidiNote): number {
  return A4_HZ * Math.pow(2, (note - A4_MIDI) / SEMITONES_PER_OCTAVE);
}

/**
 * How long one sixteenth note lasts, in seconds, at a given tempo.
 *
 * A beat is a quarter note, so a sixteenth is a quarter of a beat.
 */
export function sixteenthSeconds(tempo: number): number {
  return 60 / tempo / 4;
}

/** Total length of a song in seconds. Used to schedule and to test. */
export function songSeconds(song: Song): number {
  const sixteenths = song.notes.reduce((total, note) => total + note.duration, 0);
  return sixteenths * sixteenthSeconds(song.tempo);
}
