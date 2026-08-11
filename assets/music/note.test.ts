import { describe, expect, it } from 'vitest';

import { midiToFrequency, sixteenthSeconds, songSeconds, type Song } from './note.ts';

/**
 * WHY THIS FILE EXISTS
 *
 * Audio is the one part of a game nobody tests, because "does it sound right?"
 * feels like it needs ears. It does — but only for the last mile. Everything
 * before that is arithmetic, and arithmetic is exactly what tests are for.
 *
 * By authoring music as note data (like the sprites) and converting to
 * frequencies with a documented formula, the whole pipeline up to the
 * oscillator is pure and checkable with no audio hardware and no listening.
 * What is left for a human ear is genuinely only the timbre.
 */
describe('midiToFrequency', () => {
  /**
   * TYPE: unit.
   * WHY THIS TYPE: one formula, exact expected values. Nothing slower could
   *   say more, and an e2e test would need a microphone.
   * MEASURES: the anchor of the tuning system.
   * ORACLE: the international standard — A4, MIDI note 69, is 440Hz. This is a
   *   fact about music, not about our code, which is what makes the test
   *   non-tautological.
   * CATCHES: an off-by-one in the MIDI numbering, which transposes the entire
   *   soundtrack by a semitone. It would still sound like a tune, just the
   *   wrong one — the kind of bug that survives casual listening forever.
   * LOAD-BEARING: yes.
   */
  it('maps MIDI note 69 to concert A at 440Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 10);
  });

  /**
   * TYPE: unit.
   * MEASURES: that twelve semitones double the frequency.
   * ORACLE: the definition of an octave in equal temperament.
   * CATCHES: dividing by the wrong root — using 2^(n/6) or 2^n — which
   *   compresses or explodes every interval. The tune becomes unrecognisable.
   * LOAD-BEARING: yes.
   */
  it('doubles the frequency one octave up', () => {
    expect(midiToFrequency(81)).toBeCloseTo(880, 10);
    expect(midiToFrequency(57)).toBeCloseTo(220, 10);
  });

  /**
   * TYPE: unit.
   * MEASURES: middle C, the note everyone can check by hand.
   * ORACLE: MIDI 60 is middle C at approximately 261.63Hz — a published value.
   * CATCHES: an anchor error that the A440 test alone would miss if the
   *   semitone ratio were also wrong in a compensating direction.
   * LOAD-BEARING: yes.
   *
   * NOTE ON toBeCloseTo: this is one of the very few places in this codebase
   * where an approximate comparison is correct. Everywhere else — positions,
   * scores, frame counts — the design uses integers precisely so assertions
   * can be exact. Frequency is genuinely irrational (it involves a twelfth
   * root of two), so demanding exactness here would be demanding the wrong
   * thing. The precision is stated explicitly rather than left to a default.
   */
  it('maps MIDI note 60 to middle C', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.6255653, 6);
  });
});

describe('sixteenthSeconds', () => {
  /**
   * TYPE: unit.
   * MEASURES: that tempo converts to real time correctly.
   * ORACLE: the definition of BPM — a beat is a quarter note, so at 120 BPM a
   *   quarter note lasts 0.5s and a sixteenth lasts 0.125s.
   * CATCHES: treating BPM as sixteenths per minute, which plays every tune
   *   four times too fast. The death jingle would finish before the animation.
   * LOAD-BEARING: yes.
   */
  it('gives an eighth of a second per sixteenth at 120 BPM', () => {
    expect(sixteenthSeconds(120)).toBeCloseTo(0.125, 10);
  });

  /**
   * TYPE: unit.
   * MEASURES: that the relationship is inverse.
   * ORACLE: arithmetic — twice the tempo is half the duration.
   * CATCHES: a multiplication where a division belongs, which makes faster
   *   music slower. Easy to write, obvious once stated, invisible until heard.
   *
   * LOAD-BEARING: no — and I predicted yes, wrongly. This asserts a RATIO
   *   between two calls, and a stub returning 0 satisfies `0 === 0 / 2`.
   *
   *   Add it to the family: a test is NOT load-bearing when its assertion
   *   compares two outputs of the thing under test rather than one output
   *   against an external value. Ratios, symmetry, idempotence, round-trips
   *   and "does not mutate" are all satisfied by a constant function. They are
   *   real guards — this one still catches a multiply-instead-of-divide once
   *   an implementation exists — but they specify nothing on their own, and
   *   the test above it, which compares against the external value 0.125, is
   *   what actually pins the behaviour.
   */
  it('halves the note length when the tempo doubles', () => {
    expect(sixteenthSeconds(240)).toBeCloseTo(sixteenthSeconds(120) / 2, 10);
  });
});

describe('songSeconds', () => {
  const song: Song = {
    name: 'test',
    tempo: 120,
    loop: false,
    /* Deliberately mixed durations AND a rest. A song of four identical quarter
       notes would pass even if the implementation counted notes instead of
       summing durations — the classic degenerate fixture. */
    notes: [
      { pitch: 60, duration: 4 },
      { pitch: null, duration: 2 },
      { pitch: 64, duration: 1 },
    ],
  };

  /**
   * TYPE: unit.
   * MEASURES: that the length sums DURATIONS, and that rests take time.
   * ORACLE: arithmetic — 4 + 2 + 1 = 7 sixteenths at 0.125s each = 0.875s.
   * CATCHES: two bugs at once. Counting notes rather than summing durations
   *   (which the mixed fixture defeats), and skipping rests because they have
   *   no pitch — which would make every tune with silence in it finish early
   *   and desynchronise anything scheduled after it.
   * LOAD-BEARING: yes.
   */
  it('sums note durations, counting rests as time that passes', () => {
    expect(songSeconds(song)).toBeCloseTo(0.875, 10);
  });

  /**
   * TYPE: unit.
   * MEASURES: the empty case.
   * ORACLE: a stated invariant — a song with no notes takes no time.
   * CATCHES: a reduce with no initial value, which throws on an empty array
   *   rather than returning zero.
   * LOAD-BEARING: no — a stub returning 0 satisfies it. Guard, and worth
   *   keeping: the empty song is exactly the input a real implementation is
   *   most likely to crash on.
   */
  it('takes no time when there are no notes', () => {
    expect(songSeconds({ name: 'empty', tempo: 120, loop: false, notes: [] })).toBe(0);
  });
});
