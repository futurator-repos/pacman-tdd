/**
 * Every sound the game can ask for.
 *
 * This lives in `core/` rather than in `assets/` on purpose. *What to play* is
 * a game rule — the siren rises with the level, the death jingle plays instead
 * of the siren, eating a ghost interrupts everything — and rules belong in the
 * pure layer where they can be tested without an audio context.
 *
 * `assets/music/songs.ts` then types its table as
 * `Readonly<Record<AudioCue, Song>>`, so inventing a cue with no tune is a
 * COMPILE error rather than silence at runtime. Silence is the worst possible
 * audio bug: nothing crashes, no test fails, and the only symptom is that a
 * sound a player expected never arrives.
 */
export const AudioCue = {
  /** The opening fanfare, before the first round. */
  Intro: 'intro',
  /** The looping background siren. Rises in pitch as dots are eaten. */
  Siren: 'siren',
  /** Replaces the siren while ghosts are frightened. */
  Frightened: 'frightened',
  /** The rising warble of eyes returning to the house. */
  Retreating: 'retreating',
  /** One bite of a dot. */
  Chomp: 'chomp',
  /** Eating a ghost. */
  GhostEaten: 'ghostEaten',
  /** Eating the bonus fruit. */
  FruitEaten: 'fruitEaten',
  /** Pac-Man is caught. */
  Death: 'death',
  /** The 10000-point bonus. */
  ExtraLife: 'extraLife',
} as const;

export type AudioCue = (typeof AudioCue)[keyof typeof AudioCue];

/** Every cue, for exhaustiveness checks and for tests that must cover them all. */
export const ALL_AUDIO_CUES: readonly AudioCue[] = Object.values(AudioCue);
