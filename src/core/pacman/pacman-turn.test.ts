import { describe, expect, it } from 'vitest';

import { type Actor, type TurnContext, isAtTileCentre, tileOf } from '../actor/actor.ts';
import { Direction } from '../geometry/direction.ts';
import { type Vector2 } from '../geometry/vector.ts';
import { type Maze } from '../maze/maze.ts';
import { crossroadsMaze } from '../testing/tiny-maze.ts';

import { pacmanTurnPolicy } from './pacman-turn.ts';

/**
 * Pac-Man's turn policy — the rule that makes the controls feel responsive.
 *
 * WHAT A TURN POLICY IS. `move-actor.ts` resolves a frame ONE PIXEL AT A TIME
 * and asks a `TurnPolicy` before every pixel. The policy answers one question —
 * "which way do you leave the pixel you are standing on?" — and never touches a
 * position. That separation is why this whole file is hand-built
 * `TurnContext` values and not a single frame of movement: a failure here says
 * "the rule is wrong", and a failure in `pacman.test.ts` says "the rule and the
 * mover are wired up wrong". Testing only through the mover would conflate the
 * two and make every failure ambiguous.
 *
 * ORACLE FOR THE WHOLE FILE: docs/ARCADE-REFERENCE.md section 8.4.
 *   - a queued direction is applied the moment the maze allows it, and is kept
 *     until then rather than discarded;
 *   - a REVERSAL is applied immediately, at whatever pixel Pac-Man occupies,
 *     because he is already in a corridor that runs that way;
 *   - releasing the joystick does not stop him.
 *
 * THE FIXTURE. `crossroadsMaze()` from `src/core/testing/tiny-maze.ts`:
 *
 * ```
 *      col 0123456789A
 * row 0    ###########
 * row 1    #####H#####
 * row 2    #####-#####     - = the ghost-house gate
 * row 3    #####.#####
 * row 4    #....P....#
 * row 5    #####.#####
 * row 6    ###########
 * ```
 *
 * A tile is 8 pixels and its CENTRE pixel is (col*8 + 4, row*8 + 4)
 * (docs/ARCADE-REFERENCE.md, and pinned by `tile.test.ts`), so:
 *   (5,4) — the four-way junction — has its centre at (44, 36);
 *   (3,4) — plain corridor, wall above — has its centre at (28, 36);
 *   (5,3) — the tile below the gate — has its centre at (44, 28).
 * Every pixel literal below is that arithmetic written out, never imported.
 */

/**
 * Build the exact `TurnContext` the mover would hand the policy at `position`.
 *
 * `tileOf` and `isAtTileCentre` are slice s03's, already implemented and
 * already pinned by `actor.test.ts`. Using them rather than recomputing the
 * arithmetic here keeps this file about the TURN RULE: if "which tile is this"
 * were rewritten inside this test, a bug in that could quietly disguise a bug
 * in what is actually under test.
 */
function contextAt(
  maze: Maze,
  position: Vector2,
  facing: Direction,
  queued: Direction | null,
  mayPassDoor = false,
): TurnContext {
  const actor: Actor = { position, facing, queued, carrySubPixels: 0 };
  return { actor, tile: tileOf(actor), atTileCentre: isAtTileCentre(actor), maze, mayPassDoor };
}

describe('pacmanTurnPolicy', () => {
  /*
   * TYPE: unit
   * WHY THIS TYPE: The policy is a pure function of a TurnContext, so all three
   *   situations are built by hand with no maze traversal and no mover at all.
   *   Three assertions in one test rather than three tests, because the rule is
   *   a single three-way choice and reading them together is what shows it is
   *   one rule and not three.
   * MEASURES: The direction returned for a legal queued turn at a junction
   *   centre, for an illegal queued turn at a corridor centre, and for a null
   *   queue.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4 — player input is intent,
   *   applied as soon as the corridor allows and never at the cost of the
   *   current heading; letting go of the joystick does not stop Pac-Man. The
   *   maze facts come from the fixture drawn above: up is open from (5,4) and
   *   walled from (3,4).
   * CATCHES: Returning the queued direction unconditionally, which walks
   *   Pac-Man into the wall above (3,4) and stops him dead mid-corridor; or
   *   defaulting the direction when nothing is held, so he halts or veers every
   *   time the player lets go of the stick.
   * LOAD-BEARING: yes — but only just, and the reason is worth knowing. The
   *   stub returns `ctx.actor.facing`, which is the CORRECT answer to the
   *   second and third assertions; only the first one fails. The last two are
   *   guards travelling inside a load-bearing test.
   */
  it('takes a legal queued turn at once, and keeps facing when it is illegal or absent', () => {
    const maze = crossroadsMaze();

    /* At the junction centre, with up open: the turn happens now. */
    expect(pacmanTurnPolicy(contextAt(maze, { x: 44, y: 36 }, Direction.Right, Direction.Up))).toBe(
      Direction.Up,
    );

    /* Mid-corridor centre with a wall above: keep going, keep the request. */
    expect(pacmanTurnPolicy(contextAt(maze, { x: 28, y: 36 }, Direction.Right, Direction.Up))).toBe(
      Direction.Right,
    );

    /* Nothing queued: Pac-Man never stops of his own accord. */
    expect(pacmanTurnPolicy(contextAt(maze, { x: 44, y: 36 }, Direction.Right, null))).toBe(
      Direction.Right,
    );
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: One context, one assertion, at a pixel deliberately chosen
   *   NOT to be a tile centre. The reversal is an explicit exception to the
   *   tile-centre rule, so it has to be stated on its own or it will be quietly
   *   lost in a refactor that "simplifies" turning into a single centre check.
   * MEASURES: That the opposite of the current facing is returned at x = 41,
   *   which is inside tile (5,4) (pixels 40..47) and three pixels short of its
   *   centre at 44.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4 — a reversal is applied
   *   immediately, at whatever pixel Pac-Man occupies, because the corridor he
   *   stands in already runs that way. This is the one rule that is the exact
   *   OPPOSITE of the ghost rule, where a self-willed reversal is forbidden.
   * CATCHES: Reversal deferred to the next tile centre. That adds up to seven
   *   pixels of lag to every about-face — a tenth of a second at level-1 speed,
   *   in exactly the moments a player is trying to escape a ghost. The game
   *   still works; it just feels wrong, which is the hardest class of bug to
   *   find without a test that names it.
   * LOAD-BEARING: yes (the stub keeps facing right).
   */
  it('takes a queued reversal immediately, at a pixel that is not a tile centre', () => {
    const maze = crossroadsMaze();

    expect(
      pacmanTurnPolicy(contextAt(maze, { x: 41, y: 36 }, Direction.Right, Direction.Left)),
    ).toBe(Direction.Left);
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: The discriminating partner of the test above. Same tile,
   *   same off-centre pixel, same legal destination — the ONLY difference is
   *   that the queued direction is perpendicular rather than opposite. Without
   *   it, "apply the queue at any pixel" passes the reversal test and looks
   *   correct.
   * MEASURES: That a perpendicular turn is refused at x = 41, even though up is
   *   open from tile (5,4) and would be taken three pixels later at the centre.
   * ORACLE: docs/ARCADE-REFERENCE.md section 8.4 — perpendicular turns land on
   *   the tile centre; only the reversal is free of that constraint.
   * CATCHES: A policy that applies any queued direction at any pixel. Pac-Man
   *   would cut corners diagonally off-grid, arrive at tiles his centre never
   *   passed through, and eat dots on tiles he visibly missed.
   * LOAD-BEARING: no — a guard. The do-nothing stub returns facing, which is
   *   the right answer here. It is worth keeping because it is the only test
   *   that stops the reversal rule from being over-generalised.
   */
  it('refuses a queued perpendicular turn off a tile centre, which is what keeps corners square', () => {
    const maze = crossroadsMaze();

    expect(pacmanTurnPolicy(contextAt(maze, { x: 41, y: 36 }, Direction.Right, Direction.Up))).toBe(
      Direction.Right,
    );
  });

  /*
   * TYPE: unit
   * WHY THIS TYPE: Two contexts identical in every field except `mayPassDoor`,
   *   which is the only way to show that the policy ASKS the context rather
   *   than hard-coding what Pac-Man is allowed to do. Written as one test
   *   because the claim is the contrast, and either half alone is satisfied by
   *   a constant.
   * MEASURES: The direction returned at the centre of (5,3), facing down, with
   *   up queued and the ghost-house gate directly above at (5,2) — once with
   *   permission refused and once with it granted.
   * ORACLE: the `isWalkable` contract documented in `maze.ts` and pinned by
   *   `maze.test.ts` — "ghosts leave the house through the gate, Pac-Man can
   *   never enter it", carried as the single `mayPassDoor` parameter. Cited
   *   that way deliberately, rather than at docs/ARCADE-REFERENCE.md: that
   *   document covers the ghost house in section 12 but states no rule anywhere
   *   about Pac-Man and the gate, so the asymmetry is this repo's convention and
   *   `isWalkable` is where it is written down. The policy's job is to consult
   *   the flag, not to decide it — slice s10's pacman-system is what passes
   *   false for Pac-Man.
   * NOTE ON THE FIXTURE: up is also the REVERSAL of down here, which is not an
   *   accident. It makes this the one context where "reversal wins outright" and
   *   "walkability is checked first" give different answers, so the test pins
   *   the ordering too: the reversal exception frees a turn from the tile-centre
   *   rule only, never from the wall check. See the rule list in
   *   `pacman-turn.ts`.
   * CATCHES: A policy that ignores mayPassDoor and tests walkability with a
   *   hard-coded false. It would work perfectly for Pac-Man and then be
   *   unusable for anything else, so the first attempt to share the movement
   *   engine would silently seal every ghost inside the house.
   * LOAD-BEARING: yes (the stub keeps facing down, so the permitted case
   *   fails).
   */
  it('asks the context for door permission instead of hard-coding it', () => {
    const maze = crossroadsMaze();
    const belowTheGate: Vector2 = { x: 44, y: 28 };

    expect(
      pacmanTurnPolicy(contextAt(maze, belowTheGate, Direction.Down, Direction.Up, false)),
    ).toBe(Direction.Down);

    expect(
      pacmanTurnPolicy(contextAt(maze, belowTheGate, Direction.Down, Direction.Up, true)),
    ).toBe(Direction.Up);
  });
});
