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

/* STUB — slice s05 RED phase. Signature only, no behaviour. `false` is the
   inert value: it must not make a single assertion pass that ought to fail. */
export function isFrightened(_ghost: Ghost): boolean {
  return false;
}
