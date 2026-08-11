import { describe, expect, it } from 'vitest';

import { ALL_AUDIO_CUES, AudioCue } from '../../src/core/audio/audio-cue.ts';

import { midiToFrequency, songSeconds, type Song } from './note.ts';
import { SONGS } from './songs.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * The tunes are data, so they can be checked like any other data — and they
 * need checking, because the failure mode of wrong audio data is SILENCE, and
 * silence crashes nothing, fails nothing, and looks exactly like "audio is off".
 *
 * These tests cannot tell you whether the music sounds good. They can tell you
 * that every cue has a tune, that no tune is empty, that pitches are playable,
 * and that the looping ones loop. That is the boundary: everything mechanical
 * is here, and only timbre and taste are left to an ear.
 */

/**
 * Looks a song up at RUNTIME and throws if it is absent.
 *
 * The widening cast is the point, and it is worth explaining because it looks
 * like a cheat. `SONGS` is typed `Record<AudioCue, Song>`, which asserts the
 * table is TOTAL — so to the compiler a missing entry is impossible, and
 * `expect(SONGS[cue]).toBeDefined()` is a tautology it can prove without
 * running anything. eslint says so directly: "the types have no overlap".
 *
 * But a type is a claim, not a measurement. A table built by a loop, a spread,
 * or a partial refactor can absolutely be missing a key at runtime while still
 * satisfying that type. Widening to `Partial` here says: ignore the claim and
 * go and look.
 *
 * The general lesson: a total type makes a completeness test meaningless unless
 * the test deliberately steps outside the type to check.
 */
function requireSong(cue: AudioCue): Song {
  const table: Partial<Record<AudioCue, Song>> = SONGS;
  const song = table[cue];
  if (song === undefined) {
    throw new Error(`No song for cue '${cue}'`);
  }
  return song;
}

describe('the song table', () => {
  /**
   * TYPE: unit (completeness).
   * WHY THIS TYPE: the table is data. Discovering a missing cue by playing the
   *   game means noticing an absence, which is the hardest thing to notice.
   * MEASURES: that every declared cue has a tune.
   * ORACLE: the AudioCue union in src/core/audio/audio-cue.ts — the set of
   *   sounds the rules can ask for.
   * CATCHES: a cue the audio decision emits with nothing behind it. The player
   *   eats a ghost and hears nothing; no error is raised anywhere.
   * LOAD-BEARING: yes.
   */
  it('has a tune for every cue the game can request', () => {
    /* Compares the table's ACTUAL keys, not typed lookups. See requireSong
       above: a `Record<AudioCue, Song>` type makes a per-key `toBeDefined()`
       something the compiler can prove, which is the same as asserting
       nothing. Reading Object.keys steps outside the claim and measures. */
    expect([...Object.keys(SONGS)].sort()).toEqual([...ALL_AUDIO_CUES].sort());
  });

  /**
   * TYPE: unit.
   * MEASURES: that no tune is empty.
   * ORACLE: a stated invariant — a cue exists because something should be
   *   audible.
   * CATCHES: a placeholder left behind as `notes: []`, which type-checks,
   *   satisfies the completeness test above, and plays nothing at all. This is
   *   precisely why the previous test is not sufficient on its own.
   * LOAD-BEARING: yes.
   */
  it('gives every tune at least one note', () => {
    expect.assertions(ALL_AUDIO_CUES.length);
    for (const cue of ALL_AUDIO_CUES) {
      expect(requireSong(cue).notes.length).toBeGreaterThan(0);
    }
  });

  /**
   * TYPE: unit.
   * MEASURES: that every pitch is inside the audible, playable MIDI range.
   * ORACLE: MIDI defines notes 0-127; the arcade's square-wave voices sit
   *   roughly between note 36 (65Hz) and note 96 (2093Hz). Anything outside is
   *   either inaudible or a shriek.
   * CATCHES: a typo that turns note 72 into 720. It would type-check, and
   *   `midiToFrequency` would happily return an ultrasonic frequency the
   *   speaker cannot produce — inaudible, silent, and untraceable.
   * LOAD-BEARING: yes.
   */
  it('keeps every pitch within the audible arcade range', () => {
    const pitches = ALL_AUDIO_CUES.flatMap((cue) =>
      requireSong(cue)
        .notes.map((note) => note.pitch)
        .filter((pitch): pitch is number => pitch !== null),
    );

    expect(pitches.length).toBeGreaterThan(0);
    for (const pitch of pitches) {
      expect(pitch).toBeGreaterThanOrEqual(36);
      expect(pitch).toBeLessThanOrEqual(96);
    }
  });

  /**
   * TYPE: unit.
   * MEASURES: that durations are positive.
   * ORACLE: a stated invariant — a note of zero length is not a note.
   * CATCHES: a zero or negative duration, which produces a scheduling call
   *   with a start time at or before the previous note's, and in Web Audio
   *   that either throws or silently drops the note.
   * LOAD-BEARING: yes.
   */
  it('gives every note a positive duration', () => {
    const durations = ALL_AUDIO_CUES.flatMap((cue) =>
      requireSong(cue).notes.map((note) => note.duration),
    );

    expect(durations.length).toBeGreaterThan(0);
    for (const duration of durations) {
      expect(duration).toBeGreaterThan(0);
    }
  });

  /**
   * TYPE: unit.
   * MEASURES: which tunes loop and which do not.
   * ORACLE: gameplay — the siren, the frightened warble and the retreat sound
   *   continue for as long as their state lasts, so they must loop. The
   *   jingles are one-shot: a looping death jingle never stops.
   * CATCHES: the two opposite bugs at once — a siren that plays once and
   *   leaves the round silent, and a death jingle that loops forever over the
   *   next round.
   * LOAD-BEARING: yes.
   */
  it('loops the continuous sounds and only those', () => {
    const looping = ALL_AUDIO_CUES.filter((cue) => requireSong(cue).loop);

    expect([...looping].sort()).toEqual(
      [AudioCue.Siren, AudioCue.Frightened, AudioCue.Retreating].sort(),
    );
  });

  /**
   * TYPE: unit.
   * MEASURES: that the one-shot jingles are short enough to be jingles.
   * ORACLE: gameplay timing — the death animation is 180 frames, three
   *   seconds (docs/ARCADE-REFERENCE.md section 7). A death jingle longer than
   *   its animation would still be playing when the next round starts.
   * CATCHES: a tempo typo. At 30 BPM instead of 120 the same notes take four
   *   times as long, which no test of the note data alone would notice.
   * LOAD-BEARING: yes.
   */
  it('keeps the death jingle within its animation', () => {
    expect(songSeconds(requireSong(AudioCue.Death))).toBeLessThanOrEqual(3);
  });

  /**
   * TYPE: unit.
   * MEASURES: that the chomp is short enough to keep up with eating.
   * ORACLE: at full speed Pac-Man eats a dot roughly every 8 frames, about
   *   0.13s (docs/ARCADE-REFERENCE.md section 2). A chomp longer than that
   *   overlaps itself into a drone.
   * CATCHES: a chomp authored as a tune rather than a blip, which turns the
   *   most frequent sound in the game into mush.
   * LOAD-BEARING: yes.
   */
  it('keeps the chomp shorter than the gap between two dots', () => {
    expect(songSeconds(requireSong(AudioCue.Chomp))).toBeLessThan(0.15);
  });

  /**
   * TYPE: unit (integration with note.ts).
   * WHY THIS TYPE: this is the only test that runs the real note data through
   *   the real conversion, which is the actual path the synthesiser takes.
   * MEASURES: that every authored pitch converts to a sane frequency.
   * ORACLE: human hearing runs about 20Hz-20kHz; these tunes should sit well
   *   inside it.
   * CATCHES: a mismatch between the range check above and the conversion
   *   formula. The range test asserts MIDI numbers; this asserts the hertz a
   *   speaker actually receives, and only this would catch a broken formula
   *   paired with valid data.
   * LOAD-BEARING: yes.
   */
  it('converts every authored pitch to an audible frequency', () => {
    const frequencies = ALL_AUDIO_CUES.flatMap((cue) =>
      requireSong(cue)
        .notes.map((note) => note.pitch)
        .filter((pitch): pitch is number => pitch !== null)
        .map(midiToFrequency),
    );

    expect(frequencies.length).toBeGreaterThan(0);
    for (const hz of frequencies) {
      expect(hz).toBeGreaterThan(20);
      expect(hz).toBeLessThan(20000);
    }
  });

  /**
   * TYPE: unit.
   * MEASURES: that the intro is a real tune, not a placeholder beep.
   * ORACLE: the arcade's opening fanfare is a recognisable melody of roughly
   *   twenty notes over about four seconds.
   * CATCHES: shipping a stub tune. Every other test here passes for a
   *   one-note intro, so without this the table can be "complete" and still
   *   sound like nothing was written.
   * LOAD-BEARING: yes.
   */
  it('gives the intro a real melody rather than a placeholder', () => {
    const intro = requireSong(AudioCue.Intro);

    expect(intro.notes.length).toBeGreaterThanOrEqual(12);
    expect(songSeconds(intro)).toBeGreaterThan(1);
  });
});
