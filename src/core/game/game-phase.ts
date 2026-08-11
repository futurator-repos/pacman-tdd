/**
 * What the round is doing right now, and for how many more frames.
 *
 * A Pac-Man game is not always playable. It opens on a "READY!" pause, it
 * freezes while Pac-Man spins into nothing, and it stops dead while the cleared
 * maze flashes. Modelling those as PHASES rather than as a scatter of booleans
 * (`isDying`, `isPaused`, `levelJustEnded`) is what lets one system — the phase
 * system in slice s10 — decide each frame whether anything is allowed to move.
 * Two booleans can contradict each other; one phase cannot.
 *
 * A const object rather than an enum: `erasableSyntaxOnly` is on, so the type
 * layer must vanish at build time with no runtime construct left behind. Same
 * shape as `Direction`, `TileKind` and `GhostPhase`.
 */

export const RoundPhase = {
  /** The "READY!" pause before a round. Nothing moves. */
  Ready: 'ready',
  /** The only phase in which the world is simulated. */
  Playing: 'playing',
  /** Pac-Man has been caught: the death freeze, then the death animation. */
  Dying: 'dying',
  /** Every dot is gone and the maze is flashing. */
  LevelComplete: 'levelComplete',
  /** The last life is spent. */
  GameOver: 'gameOver',
} as const;

export type RoundPhase = (typeof RoundPhase)[keyof typeof RoundPhase];

/**
 * How long each phase lasts, in frames. docs/ARCADE-REFERENCE.md section 7.2.
 *
 * A `Record` keyed by the union rather than a `switch`, for one reason worth
 * naming: adding a sixth phase then becomes a COMPILE error here, in the one
 * place a duration must be decided, instead of a silent `default: return 0` that
 * makes the new phase last no time at all.
 *
 * Zero means "no timer" — the phase ends because something happened, not
 * because a counter ran out. `playing` ends when Pac-Man is caught or the board
 * is cleared; `gameOver` does not end.
 *
 * The three timed rows are deliberately not all the same number. 120, 180 and
 * 120 could all have been "about two seconds" and nobody would notice in play;
 * distinct values mean an implementation that reads the WRONG ROW — the classic
 * copy-paste bug in a table like this — fails an assertion instead of shipping.
 */
export const PHASE_FRAMES: Readonly<Record<RoundPhase, number>> = {
  [RoundPhase.Ready]: 120,
  [RoundPhase.Playing]: 0,
  [RoundPhase.Dying]: 180,
  [RoundPhase.LevelComplete]: 120,
  [RoundPhase.GameOver]: 0,
};
