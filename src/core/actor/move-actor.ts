/**
 * SIGNATURE-ONLY STUB — RED phase of slice s03.
 *
 * The do-nothing mover: it hands back the actor it was given, unmoved and
 * unturned, and never consults the turn policy. That is the most inert thing a
 * mover can be, and it is deliberately chosen: every test in move-actor.test.ts
 * whose expected position differs from its starting position must therefore
 * fail on an assertion, with a real expected-vs-received diff.
 *
 * It also doubles as the measuring instrument described in
 * docs/TDD-FINDINGS.md: any test that PASSES against this file is either
 * vacuous (a defect) or a guard (states an invariant but pins no behaviour),
 * and the RED report must say which.
 */
import { type MoveRequest, type MoveResult, type TurnPolicy } from './actor.ts';

/**
 * Advance one actor by one frame.
 *
 * Everything positional lives here and nowhere else: the sub-pixel carry, the
 * pixel-by-pixel stepping, the wall stop, the turn (delegated to the policy)
 * and the tunnel wrap. Ghost AI and Pac-Man's input handling therefore never
 * touch geometry — they only supply a policy.
 */
export function moveActor(request: MoveRequest, _turn: TurnPolicy): MoveResult {
  return {
    actor: request.actor,
    enteredTile: null,
    blocked: false,
    turned: false,
  };
}
