import { type AudioCue } from '../../src/core/audio/audio-cue.ts';

import { type Song } from './note.ts';

/**
 * SIGNATURE-ONLY STUB — RED phase. No tunes.
 * See docs/TDD-CHARTER.md, Challenge 1.
 */
export const SONGS: Readonly<Record<AudioCue, Song>> = {} as Readonly<Record<AudioCue, Song>>;
