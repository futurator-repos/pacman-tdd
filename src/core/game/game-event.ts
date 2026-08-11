import { type Tile } from '../geometry/tile.ts';
import { type GhostId } from '../ghost/ghost-id.ts';
import { type FruitKind } from '../rules/level-spec.ts';
import { type GlobalMode } from '../rules/mode-schedule.ts';

import { type RoundPhase } from './game-phase.ts';

/**
 * Everything the core can say about what just happened.
 *
 * This union is the AUDIO CHANNEL. The renderer is a pure function of state —
 * it can look at the score and draw it — but a sound is not a thing that is
 * true, it is a thing that HAPPENED, and state cannot express "happened". So
 * the split is deliberate and total: **state is the render channel, events are
 * the audio channel** (docs/ARCHITECTURE.md, "GameEvent").
 *
 * Two rules keep the vocabulary from rotting:
 *
 * 1. **Every event is an occurrence, never a mirror of state.** There is no
 *    `scoreChanged`, because the score is drawable and drawable things travel
 *    as state. An event that duplicates a field is a second source of truth,
 *    and the two will disagree the first time one of them is forgotten.
 * 2. **Each event carries what its consumer needs.** `pelletEaten` carries the
 *    remaining count so the siren can pick its tier without reaching back into
 *    the game state; `ghostEaten` carries its own points and chain index so the
 *    HUD never has to recompute the ladder.
 *
 * `switch-exhaustiveness-check` is an eslint ERROR in this repo, which turns
 * this file into a lever: adding a variant here breaks the build in every
 * consumer that switches on `kind` until each one handles it. The compiler, not
 * a reviewer, keeps the audio director and the tests in step with the rules.
 *
 * This file declares types only. It has no runtime and therefore no test of its
 * own — its correctness is checked by the consumers that must compile against
 * it, which is a stronger check than any assertion could be.
 */
export type GameEvent =
  | { readonly kind: 'roundStarted'; readonly level: number }
  | { readonly kind: 'phaseChanged'; readonly phase: RoundPhase }
  | { readonly kind: 'pelletEaten'; readonly tile: Tile; readonly remaining: number }
  | { readonly kind: 'powerPelletEaten'; readonly tile: Tile; readonly frames: number }
  | { readonly kind: 'frightenedStarted'; readonly frames: number }
  | { readonly kind: 'frightenedEnded' }
  | {
      readonly kind: 'ghostEaten';
      readonly ghost: GhostId;
      readonly points: number;
      readonly chain: number;
    }
  | { readonly kind: 'ghostReturnedHome'; readonly ghost: GhostId }
  | { readonly kind: 'ghostReleased'; readonly ghost: GhostId }
  | { readonly kind: 'modeChanged'; readonly mode: GlobalMode; readonly waveIndex: number }
  | { readonly kind: 'fruitAppeared'; readonly fruit: FruitKind }
  | { readonly kind: 'fruitEaten'; readonly fruit: FruitKind; readonly points: number }
  | { readonly kind: 'fruitExpired'; readonly fruit: FruitKind }
  | { readonly kind: 'extraLife'; readonly lives: number }
  | { readonly kind: 'pacmanCaught'; readonly ghost: GhostId }
  | { readonly kind: 'pacmanDied'; readonly livesLeft: number }
  | { readonly kind: 'levelCleared'; readonly level: number }
  | { readonly kind: 'gameOver'; readonly score: number };

/**
 * The event list a system returns when nothing happened.
 *
 * Shared rather than a fresh `[]` per system, so "this system emitted nothing"
 * is one object identity across the whole pipeline. It costs nothing and it
 * makes an accidental `events.push(...)` a runtime error instead of a
 * cross-system leak.
 */
export const NO_EVENTS: readonly GameEvent[] = Object.freeze([]);
