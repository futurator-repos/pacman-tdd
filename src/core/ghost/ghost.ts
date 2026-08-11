import type { Actor } from '../actor/actor.ts';

import type { GhostId } from './ghost-id.ts';

/**
 * What a ghost is doing, structurally.
 *
 * A const object rather than an enum: `erasableSyntaxOnly` is on, so the type
 * layer must vanish at build time with no runtime construct left behind.
 *
 * Note what is ABSENT: there is no `Frightened` phase. Fright is a timer that
 * runs alongside whatever the ghost is already doing, which is why a ghost
 * sitting in the house still turns blue when a power pellet is eaten, and why
 * an eaten ghost's eyes still remember they were heading home. One fact, one
 * field — see `isFrightened` below.
 */
export const GhostPhase = {
  InHouse: 'inHouse',
  LeavingHouse: 'leavingHouse',
  Hunting: 'hunting',
  Eyes: 'eyes',
  EnteringHouse: 'enteringHouse',
} as const;

export type GhostPhase = (typeof GhostPhase)[keyof typeof GhostPhase];

export interface Ghost {
  readonly id: GhostId;
  readonly actor: Actor;
  readonly phase: GhostPhase;
  /** Counts down; zero means not frightened. Orthogonal to `phase`. */
  readonly frightenedFramesLeft: number;
  readonly dotCounter: number;
  readonly dotCounterActive: boolean;
  /** Blinky only: 0 (off), 1 or 2. */
  readonly elroyStage: number;
  /** A scatter/chase flip forces a reversal at the next tile centre. */
  readonly reverseQueued: boolean;
}

/**
 * Blue or not, asked of the timer and of nothing else.
 *
 * The predicate reads ONE field on purpose. A power pellet frightens every
 * ghost, including one still sitting in the house and one already leaving it
 * (docs/ARCADE-REFERENCE.md section 6.6), so any `phase === …` term added here
 * would un-blue a ghost the arcade turns blue. The eaten-ghost exception —
 * eyes are neither blue nor edible — is carried by the collision rule, which
 * knows the phase, rather than by this function, which deliberately does not.
 *
 * Strictly greater than zero: on the frame the timer reaches zero the ghost is
 * dangerous again, not one frame later. `>= 0` would make the game unlosable.
 */
export function isFrightened(ghost: Ghost): boolean {
  return ghost.frightenedFramesLeft > 0;
}
