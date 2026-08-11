# The test plan

**Every test that will be written, before any of them is written.**

135 tests across the game. For each: what type it is, _why that type_, what it measures, where
its expected value comes from, the bug that ships without it, and whether it is load-bearing.

## Why each column matters

- **Type** — a unit test that could have been a unit test but was written as an e2e test costs
  five seconds instead of one millisecond and points at a canvas instead of a function.
- **Oracle** — where the expected value comes from. If it comes from the implementation, the test
  is a tautology and will pass forever while protecting nothing. Arcade behaviour is documented,
  which is why this game was chosen.
- **Load-bearing** — would it FAIL against a do-nothing stub? If not it is a _guard_: still useful,
  but it specifies nothing. Predicting this before running the red phase, then checking, is the
  cheapest test-quality gate there is. See [`TDD-FINDINGS.md`](TDD-FINDINGS.md).

## Shape of the suite

| Test type   | Count   |
| ----------- | ------- |
| unit        | 96      |
| component   | 15      |
| integration | 12      |
| property    | 10      |
| visual      | 1       |
| e2e         | 1       |
| **total**   | **135** |

117 of 135 are predicted load-bearing; the remaining 18 are guards.

---

## maze-movement

### `TILE_SIZE is 8 arcade pixels and centreOf({col:2,row:3}) is the pixel {x:20,y:28}`

**unit** · load-bearing

- **Why this type:** A constant and one exact conversion, asserted together because the +4 offset is only meaningful in terms of the 8. Exact integer arithmetic on one value: a property test here would only restate the formula the implementation uses, which is the definition of a test with no oracle.
- **Measures:** The one number that converts tiles to pixels everywhere in the game, and the half-tile offset that puts an actor in the middle of a corridor rather than against its wall.
- **Oracle:** docs/ARCADE-REFERENCE.md: the original board is a 28x31 grid of 8x8 pixel tiles. centreOf follows as col*8+4, row*8+4.
- **Catches:** TILE_SIZE copied as 16 from the actor sprites (every actor at double coordinates, maze off-screen), or centreOf returning the tile's top-left corner, so isAtTileCentre is never true and no actor ever turns.

### `tileAt floors rather than truncates, so a pixel at x=-1 is column -1 and not column 0`

**unit** · load-bearing

- **Why this type:** One boundary value on the negative side of zero. The cheapest possible test for the classic Math.trunc / Math.floor confusion, which has exactly one interesting input.
- **Measures:** That pixel -> tile conversion is monotonic across zero.
- **Oracle:** Stated design invariant: tileAt must be total and monotonic so a position that has left the board through the tunnel reads as off-grid and kindAt can then report Wall. Truncation would collapse x=-1 and x=+1 into the same column.
- **Catches:** An actor stepping one pixel out of the left tunnel mouth reads as column 0, a wall tile, so he is reported blocked and the tunnel never wraps.

### `the centre pixel of any tile maps back to that same tile`

**property** · load-bearing

- **Why this type:** tileAt and centreOf must be mutually consistent over the whole 28x31 grid, not at the three points a person would pick. fast-check explores the grid and shrinks any off-by-one to the smallest failing tile, which is what makes the failure readable.
- **Measures:** The round trip tileAt(centreOf(t)) === t for every tile on the board.
- **Oracle:** Stated invariant of the pair: they are two halves of one coordinate mapping, so one must invert the other on tile centres.
- **Catches:** A +8 instead of +4 in centreOf, landing the actor on the boundary of the NEXT tile. Movement would look right in a corridor and break at every junction, which is the hardest class of bug to localise later.

### `tileEquals compares two tiles by value, not by reference`

**unit** · load-bearing

- **Why this type:** One assertion on two distinct objects with equal fields. There is no cheaper form, and nothing to integrate.
- **Measures:** That Tile behaves as a value type, which is what lets collision and targeting compare tiles at all.
- **Oracle:** Stated design invariant: Tile is a plain readonly record with no identity, so equality must be structural.
- **Catches:** Someone reaching for a === b later. Collision would never fire, because Pac-Man's tile object is never the same object as a ghost's.

### `neighbour steps exactly one tile in each direction, and up decreases the row`

**unit** · load-bearing

- **Why this type:** Four cases looped over ALL_DIRECTIONS with expect.assertions(4). The domain has four elements, so the loop is exhaustive and a property test would add generation cost for no extra coverage. expect.assertions guards the vacuous pass the charter documents: with an empty ALL_DIRECTIONS the loop body would never run and the test would pass while checking nothing.
- **Measures:** That tile-space stepping reuses toUnitVector and therefore agrees with the screen convention that y grows down.
- **Oracle:** Screen convention already pinned in direction.test.ts: up is negative y. Rows increase downward, so up decreases the row.
- **Catches:** An inverted vertical axis in tile space. Ghosts would chase downward when their target is above, and the whole AI would look plausible while being systematically wrong.

### `parseMaze rejects a row that is not the declared width, naming the offending row`

**unit** · load-bearing

- **Why this type:** A 3x3 fixture with one short row. Using the real 28x31 board here would make the failure message about the board rather than about the rule, which is the whole reason the tiny-maze fixtures exist.
- **Measures:** That a ragged layout cannot produce a Maze.
- **Oracle:** Stated invariant of the Maze record: tiles is a flat row-major array of length columns*rows, so ragged input has no legal representation.
- **Catches:** A single missing character in the 868-character ASCII board silently shifting every tile after it by one, producing a maze that looks almost right and has walls in the wrong places.

### `parseMaze rejects an unknown legend character instead of treating it as open floor`

**unit** · load-bearing

- **Why this type:** One 3x3 fixture with one bad character. The subject is a decision (fail loudly versus default quietly), which a single example states perfectly.
- **Measures:** That the legend is a closed set rather than an open one with a fallback.
- **Oracle:** Stated design rule for authored data: fail loudly. It is the same rule validateSprite already applies to a pixel key missing from the palette.
- **Catches:** A typo'd character becoming walkable floor: a hole in a wall that lets Pac-Man walk out of the maze, found by a player rather than by CI.

### `parseMaze rejects a layout with no ghost-house door`

**unit** · load-bearing

- **Why this type:** Unit on a fixture, because the requirement is structural and needs no movement to demonstrate.
- **Measures:** That houseDoorTile is genuinely non-optional rather than defaulted.
- **Oracle:** Arcade rule: ghosts leave the house through a gate tile only they may cross. A maze without one cannot release a ghost.
- **Catches:** A defaulted door at tile (0,0) in a corner wall. Ghosts head for the corner and jam in the house forever, and the symptom ('ghosts never come out') appears miles from its cause.

### `parseMaze rejects a layout with no Pac-Man spawn`

**unit** · load-bearing

- **Why this type:** Same shape and cost as the door case. Both are listed separately because a parser that validates one and forgets the other is exactly the plausible bug.
- **Measures:** That every Maze field later code treats as always-present is validated at construction.
- **Oracle:** Stated invariant: Maze.pacmanSpawn is non-optional and startGame places Pac-Man there with no fallback.
- **Catches:** startGame spawning Pac-Man inside a wall at (0,0), where he is immediately blocked in all four directions.

### `rendering a parsed maze back to ASCII reproduces the layout it was parsed from`

**unit** · load-bearing

- **Why this type:** A round trip, deliberately not a snapshot. A snapshot of the tile grid would have no oracle at all: whatever the parser produced on day one becomes the expected value forever. Here the authored layout IS the oracle, so the test is checkable by reading the two strings side by side.
- **Measures:** That the legend maps each character to the kind it names, and that the row-major index arithmetic addresses the tile the ASCII shows.
- **Oracle:** The authored CLASSIC_LAYOUT rows plus their legend, both reviewable in a diff.
- **Catches:** Tunnel tiles parsed as plain open tiles — identical in play until a ghost fails to slow down — or a transposed index that mirrors the board along its diagonal.

### `kindAt returns the declared kind for an in-bounds tile and Wall for any tile off the grid`

**unit** · load-bearing

- **Why this type:** One table-driven unit over a 3x3 fixture holding one tile of each kind, plus the four out-of-bounds directions. The totality guarantee and the actual lookup belong in one test: the out-of-bounds half alone would pass against a stub that always returns Wall, and the in-bounds half is what makes the pair honest.
- **Measures:** The lookup for wall, open, door, tunnel and house, and that reads above, below, left and right of the grid return Wall rather than undefined.
- **Oracle:** The fixture's authored legend, plus the stated design invariant that out of bounds reads as Wall — which is also the arcade's behaviour at every board edge except the tunnel row.
- **Catches:** undefined leaking out of the flat array under noUncheckedIndexedAccess, comparing unequal to every TileKind so isWalkable says false in some paths and throws in others; or a kindAt that returns Wall for everything, freezing every actor on the board.

### `isWalkable lets an actor through the ghost-house door only when mayPassDoor is true`

**unit** · load-bearing

- **Why this type:** Two cases on one tile. This is the entire Pac-Man-versus-ghost asymmetry and it needs no movement to state, so it would be wasteful to discover it through the mover.
- **Measures:** The door branch of walkability, in both directions.
- **Oracle:** Arcade rule: ghosts pass through the house gate; Pac-Man never can.
- **Catches:** Pac-Man walking into the ghost house — instant death or a permanent hiding spot, depending on the ghosts' state — or, with the flag inverted, ghosts that can never leave.

### `isWalkable accepts tunnel and house tiles and never accepts a wall`

**unit** · load-bearing

- **Why this type:** Exhaustive over the five TileKind values in one table-driven unit test, with expect.assertions so an empty table cannot pass vacuously.
- **Measures:** That walkability is decided per kind, and specifically that tunnel is open floor — the ghost slowdown is a speed rule, not a walkability rule.
- **Oracle:** TileKind's documented meanings: Tunnel is 'open, but ghosts crawl through it'; House is occupiable.
- **Catches:** Tunnel treated as wall, which seals both tunnel mouths and quietly makes several pellets unreachable, so the board can never be cleared.

### `walkableNeighbours returns candidates in ALL_DIRECTIONS order: up, left, down, right`

**unit** · load-bearing

- **Why this type:** Unit on a crossroads fixture where all four neighbours are open, so the assertion covers the full ordered array. The test imports ALL_DIRECTIONS rather than hard-coding the sequence, so reordering that array fails HERE, at a rule that depends on it, rather than in some distant ghost test.
- **Measures:** The enumeration order of legal moves.
- **Oracle:** Arcade tie-break rule, already pinned in direction.test.ts: among equidistant candidates the earlier direction in up/left/down/right wins.
- **Catches:** A neighbour order derived from object key order or from a sorted set. Ghost pathing would differ from the arcade only in ties — a bug you can watch for an hour without pinning down.

### `isNoUpTile is true for exactly the four tiles where upward turns are forbidden`

**unit** · load-bearing

- **Why this type:** Unit against ARCADE_MAZE with the coordinates cited in the test name. Cheap, because it pins only the DATA; the RULE that a ghost may not choose up on these tiles is tested in the ghost area against choose-direction.
- **Measures:** That the four no-up tiles were transcribed correctly, and that adjacent tiles are not included.
- **Oracle:** docs/ARCADE-REFERENCE.md: the four tiles at which the original hardware forbids a ghost from selecting up.
- **Catches:** A transposed col/row in one entry, forbidding up on an innocent corridor tile and permitting it where the arcade forbids it — which changes every ghost route through those junctions.

### `wrapPosition warps only on the tunnel row, and the two mouths are exact mirror images`

**unit** · load-bearing

- **Why this type:** Unit with exact expected pixels on both sides, plus a same-x control on a non-tunnel row. The mirror arithmetic is where the off-by-one lives (board width versus board width minus one) and only an exact expected value catches it; the row control is two extra lines in the same test.
- **Measures:** That the warp is gated on the row rather than applied board-wide, and that leaving one mouth by n pixels enters the other n pixels in.
- **Oracle:** Arcade board: the warp corridor exists only on the tunnel row recorded in docs/ARCADE-REFERENCE.md, and the tunnel is continuous, so motion across it is unbroken. Combined with the playfield width from the same reference.
- **Catches:** A global wrap that masks genuine out-of-bounds bugs on every other row; or a one-pixel jump at the warp, which desynchronises the sub-pixel carry so ghosts and Pac-Man leave the tunnel on different frames than the arcade would.

### `a position that has already been wrapped is left unchanged by wrapping it again`

**property** · guard

- **Why this type:** Idempotence is a claim about every x on the tunnel row, including the far overshoots a hand-written test would never think of, and fast-check shrinks a violation to the smallest failing x. (The slice describes this as an involution; realised concretely it is idempotence, because a wrapped position is already on the board.) Marked a guard honestly: an identity stub passes it.
- **Measures:** That wrapPosition always lands inside the board in a single application, for any input.
- **Oracle:** Stated postcondition of wrapPosition — the result is on the board — which forces f(f(x)) === f(x).
- **Catches:** A wrap implemented as one subtraction rather than a modulo: for a large overshoot the actor is deposited outside the board on the far side, off-screen and unrecoverable.

### `the classic layout is exactly 28 columns by 31 rows`

**unit** · load-bearing

- **Why this type:** Two assertions over authored data, and the test that makes every later layout test meaningful by ruling out the vacuous pass on an empty board.
- **Measures:** The dimensions of the authored ASCII board.
- **Oracle:** docs/ARCADE-REFERENCE.md: the original playfield is 28 tiles wide and 31 tall.
- **Catches:** A dropped or duplicated row during hand-authoring, which shifts the ghost house and every scatter target relative to the walls.

### `the classic layout holds exactly 240 pellets and 4 power pellets`

**unit** · load-bearing

- **Why this type:** A census over authored data. This one unit test is the only practical defence against a single-character typo in 868 characters of hand-written ASCII, and it is enormously cheaper than playing a level to find out.
- **Measures:** The dot count and the energizer count of the board.
- **Oracle:** docs/ARCADE-REFERENCE.md: a level contains 240 dots and 4 energizers, 244 in total.
- **Catches:** 241 dots. The level still clears and fruit still triggers, and the only symptom is a perfect score 10 points off the arcade. The reverse (239) shifts every dots-eaten trigger — fruit at 70 and 170, and Cruise Elroy's dots-left thresholds — by one dot, permanently.

### `the four power pellets sit at the arcade energizer coordinates documented in docs/ARCADE-REFERENCE.md`

**unit** · load-bearing

- **Why this type:** Four exact coordinates against authored data, with the citation in the test name so a reader can check the claim rather than trust it. No cheaper test states position and no more expensive one states it better.
- **Measures:** Where the energizers are, not merely how many there are.
- **Oracle:** docs/ARCADE-REFERENCE.md: the four energizer tile coordinates of the original board.
- **Catches:** An energizer one tile off, which changes the distance Pac-Man must travel to reach fright and therefore invalidates every documented arcade pattern.

### `the classic layout is left/right symmetric about the vertical centre line`

**unit** · guard

- **Why this type:** A single fold over the authored rows. Worth flagging honestly: this would pass against an empty or uniform layout, which is exactly why it sits directly beneath the dimensions and dot-count tests. The three together pin the board; none of them does it alone, and saying so is the instructive part.
- **Measures:** Mirror symmetry of walls and dots across the centre line.
- **Oracle:** The original board is mirror-symmetric about its vertical centre line.
- **Catches:** A wall piece typed into the left half and forgotten on the right. The maze still parses, the dot count can still be correct, and the board looks subtly wrong forever.

### `ARCADE_MAZE pins the ghost spawns, house door, house centre and fruit tile to their documented coordinates`

**unit** · load-bearing

- **Why this type:** Unit, keyed by GhostId so the assertion reads as a record rather than four array indices. These are constants with nothing to integrate. The four scatter corners the same slice mentions are pinned in the ghost area's scatter-corners.test.ts, next to the rule that consumes them, so their absence here is deliberate rather than a gap.
- **Measures:** That the special tiles the rest of the game navigates toward were transcribed correctly.
- **Oracle:** docs/ARCADE-REFERENCE.md, coordinate by coordinate, cited in the test name.
- **Catches:** Inky's and Clyde's house positions swapped, which changes who reaches the door first and therefore breaks the release order the arcade guarantees.

### `the walkable region containing Pac-Man's spawn contains all 244 dots without crossing the house door`

**integration** · load-bearing

- **Why this type:** Integration, because it composes parseMaze, kindAt, isWalkable and walkableNeighbours over the real board via a flood fill. No unit test can express reachability, and reachability alone decides whether a level is completable. It still runs in well under a millisecond, so it does not belong further up the pyramid. Note the phrasing: it asserts the reached dot count EQUALS 244 rather than 'every pellet was reached', because the latter passes vacuously against a stub that parses an empty maze.
- **Measures:** The number of pellet and power-pellet tiles inside the flood fill from the spawn, which must be exactly 244.
- **Oracle:** Game rule plus docs/ARCADE-REFERENCE.md: a level ends when all 244 dots are eaten, so all 244 must be reachable by an actor who may not cross the house door.
- **Catches:** A wall typo sealing off a pocket of the maze. The game would be unwinnable from level 1 and every other maze test would still pass.

### `each tiny-maze fixture parses as a legal maze`

**unit** · guard

- **Why this type:** A smoke check on the fixtures themselves, and cheap. It earns its place by localising failure: without it, a rotted fixture fails twenty movement tests with confusing messages instead of this one with a clear one. A guard by construction — parseMaze not throwing is all it asks.
- **Measures:** That the corridor, crossroads and dead-end fixtures satisfy parseMaze's validation.
- **Oracle:** parseMaze's own documented contract, which the fixtures must satisfy to be usable as mazes at all.
- **Catches:** A fixture edited to add a corridor and accidentally losing its house door, so every movement test using it fails inside the parser with an error about the maze rather than about movement.

### `a fresh pellet field carries the maze's 244 dots and is not cleared`

**unit** · load-bearing

- **Why this type:** One construction and two assertions. Because the counts are read from the maze, it also demonstrates that PelletField is derived from the board rather than hard-coded.
- **Measures:** remaining() at construction and isCleared() returning false.
- **Oracle:** docs/ARCADE-REFERENCE.md: 240 dots plus 4 energizers per level.
- **Catches:** A field built from pelletTiles only, so the board reports cleared while four energizers are still blinking on screen.

### `eating a pellet returns a new field with one fewer pellet and leaves the original field untouched`

**unit** · load-bearing

- **Why this type:** The assertion must check BOTH the returned value and the original value after the call — a shape only an example test states clearly, and the single most important test in the pellet file.
- **Measures:** Immutability of PelletField under eatAt, and the eaten counter incrementing by exactly one.
- **Oracle:** Stated design invariant: GameState and everything reachable from it is immutable, which is what makes replay reproducible and a failed assertion diffable.
- **Catches:** An in-place Set.delete. Replays would diverge from live play, and any test holding a 'before' state would silently be comparing that state with itself — a mutation that makes other tests lie.

### `eating an empty tile returns the field unchanged, and eating the same tile twice does not double-count`

**unit** · guard

- **Why this type:** Unit, and worth naming honestly as a guard: an eatAt that simply returned its input passes this and fails the test above it. It earns its place because callers deliberately invoke eatAt without checking first, so 'no-op on an empty tile' is a published contract rather than an accident.
- **Measures:** Idempotence of eatAt on an already-eaten tile and on a tile that never held a pellet.
- **Oracle:** Stated contract: callers need no guard before eating, so eatAt must be a no-op when there is nothing there.
- **Catches:** The eaten counter incrementing on empty tiles. Pac-Man sits on one tile for eight frames, the counter climbs, fruit appears early and Cruise Elroy engages before it should.

### `pelletAt distinguishes a power pellet from a plain pellet from an empty tile`

**unit** · load-bearing

- **Why this type:** Three cases, one function, no dependencies. This classification is the caller's entire basis for scoring 10 versus 50 and for starting fright, so it is asserted directly rather than through the eat system.
- **Measures:** The three-way classification of a tile.
- **Oracle:** Arcade rule: dots and energizers are different objects with different effects — 10 versus 50 points, and only energizers frighten the ghosts.
- **Catches:** Energizers classified as plain pellets: fright never starts and the game is unplayable past the first ghost encounter.

### `the board is cleared only when both the dots and the energizers are gone`

**unit** · load-bearing

- **Why this type:** Unit built directly into the deliberately awkward state — 240 eaten, one energizer left. That is precisely the case an implementation checking a single set gets wrong, and it is trivial to construct by hand while being nearly impossible to reach by playing.
- **Measures:** isCleared evaluated across both sets.
- **Oracle:** Arcade rule: the level advances when all 244 dots have been eaten.
- **Catches:** The level ending early with an energizer still on the board, skipping the last fright of the level and the points that go with it.

### `eating all 244 tiles in any order clears the board and reports exactly 244 eaten`

**property** · load-bearing

- **Why this type:** Order-independence is the invariant, and fast-check permutes the eating order over hundreds of runs. Three hand-picked orders would not find a double-count that only occurs when an energizer is eaten before an adjacent dot.
- **Measures:** That the eaten counter and the cleared predicate depend on the SET of tiles eaten and not on the path taken through them.
- **Oracle:** Stated invariant: the pellet field is a set, so consumption is commutative; combined with the 244 total from docs/ARCADE-REFERENCE.md.
- **Catches:** An energizer decrementing both counters, so the board reports cleared after 240 dots on some routes and not others — a bug that reproduces roughly one game in twenty and is otherwise undebuggable.

### `speedSubPixels converts an arcade speed percentage into a whole number of sub-pixels per frame, deterministically`

**unit** · load-bearing

- **Why this type:** Unit rather than property: the interesting domain is the finite set of fractions in the level table, so enumerating them is both cheaper and more precise than generating them. Integrality and same-input-same-output are asserted inside the same test, since they are properties of the same conversion.
- **Measures:** SUBPIXELS_PER_PIXEL being 256, the converted value at the documented level-1 speeds, Number.isInteger on every level-table fraction, and stability across repeated calls.
- **Oracle:** docs/ARCADE-REFERENCE.md speed table: speeds are stated as fractions of full speed, and full speed is the FULL_SPEED constant cited there.
- **Catches:** A conversion returning a float. The sub-pixel carry accumulates float error and a 10,000-frame replay drifts away from the original run, destroying the determinism the whole replay design rests on. Also catches a Math.round landing exactly on .5 for one level's speed and resolving differently on a different engine.

### `isAtTileCentre is true at the exact centre pixel and false one pixel either side`

**unit** · load-bearing

- **Why this type:** Three positions around one boundary. A tolerance-based 'near the centre' would be a different and wrong behaviour, so exactness has to be asserted with exact values rather than approximations.
- **Measures:** The predicate every turn decision is gated on.
- **Oracle:** Arcade rule: direction decisions are taken at tile centres, at one specific pixel.
- **Catches:** A centre test with a plus-or-minus-one tolerance, so a ghost evaluates its turn on two consecutive pixels and can reverse into itself at a junction.

### `an actor moving slower than one pixel per frame still moves, emitting a whole pixel on the expected frame`

**unit** · load-bearing

- **Why this type:** A short frame-by-frame loop asserting the exact frame the pixel appears on. This is the heart of sub-pixel movement and needs a concrete timeline, which a generated test cannot express.
- **Measures:** That carrySubPixels accumulates across frames and produces a pixel step exactly when the running total crosses 256.
- **Oracle:** Arcade speed model: anything below 100% moves less than a full pixel per frame and banks the remainder, which is how ghosts and Pac-Man at different percentages stay in the phase relationship the original has.
- **Catches:** The carry discarded each frame, so every actor below 100% speed never moves at all; or truncation the other way, so everybody moves at exactly 1 px/frame and all the level speed differences silently vanish.

### `after 600 frames at a fractional speed the actor is at an exactly predicted pixel, with no drift`

**unit** · load-bearing

- **Why this type:** A 600-iteration loop is still sub-millisecond, so the cheap type is the right one, and exact equality is the entire point: a tolerance of even one pixel would hide precisely the accumulating error the test exists to detect.
- **Measures:** Total displacement over ten seconds of continuous play.
- **Oracle:** Integer arithmetic on the documented speed: total pixels = floor(600 * stepSubPixels / 256). This is a fact about the arcade speed model computed independently, not a value read off the implementation.
- **Catches:** A float accumulator losing a pixel every few hundred frames. Live play looks fine; a committed replay fixture desynchronises minutes in, and the bug report reads 'the ghost caught me in the replay but not in the game'.

### `carrySubPixels is always in [0, 256) after any sequence of steps`

**property** · guard

- **Why this type:** An invariant over arbitrary speed and frame-count sequences, which fast-check covers and hand-written examples cannot. Honestly a guard — a motionless stub keeps the carry at 0 and passes — but it states the precondition every other movement test silently assumes, and it is the kind of invariant a reader should learn to write down.
- **Measures:** The bounds of the sub-pixel accumulator across long randomised runs.
- **Oracle:** Stated invariant on the Actor record: carrySubPixels is always in [0, SUBPIXELS_PER_PIXEL).
- **Catches:** A carry permitted to reach exactly 256, emitting a pixel one frame late at one particular speed; or a negative carry after a wall stop, which then swallows the following frame's movement.

### `an actor walking into a wall stops flush at the tile centre, keeps its facing, and reports blocked`

**unit** · load-bearing

- **Why this type:** One corridor fixture run for more frames than the distance requires, asserting the exact final position plus the two MoveResult fields. The slice states this as one behaviour and it reads as one: the stop, the facing and the flag are a single observable outcome, and the blocked flag is published contract (the renderer freezes the mouth on it) rather than an internal detail.
- **Measures:** Final position after the wall stops the actor, MoveResult.blocked, and actor.facing.
- **Oracle:** Arcade behaviour: Pac-Man stops with his centre on the last walkable tile's centre — not penetrating the wall face, and not short of the centre — keeps facing the wall, and his mouth stops animating.
- **Catches:** Stopping one pixel early, which leaves the actor permanently off-centre so isAtTileCentre is never true and no queued turn ever fires: Pac-Man jams in a dead end forever. Or blocked never set, so the mouth chomps at a wall indefinitely.

### `a queued direction is taken at the tile centre the moment it becomes legal`

**unit** · load-bearing

- **Why this type:** One crossroads fixture, asserting the exact frame and exact position of the turn. This is the central behaviour of the movement engine and deserves a named example with a readable timeline rather than a generated sequence.
- **Measures:** That the turn lands on the junction's centre pixel and that MoveResult.turned reports it.
- **Oracle:** Arcade behaviour: a direction request is held and applied at the first point the corridor allows it, which is a tile centre for a perpendicular turn.
- **Catches:** A turn applied one pixel past the centre, putting the actor permanently off the tile grid: every subsequent junction is missed and the actor eventually walks into a wall it should have turned at.

### `a direction requested early, or held through a corridor with no exit, is applied at the first junction that allows it`

**unit** · load-bearing

- **Why this type:** Two timelines in one test, because they are one rule at two scales: queue the turn a few pixels before the corner (the pre-turn window that makes the game feel like the arcade), and queue it many tiles before any legal exit (no expiry). A five-line ASCII fixture makes both situations obvious, which is why unit beats anything more expensive here.
- **Measures:** That queued survives across frames — a handful and a great many — until it becomes legal, and is then applied.
- **Oracle:** Arcade cornering behaviour: an input given shortly before a junction is honoured at the junction rather than requiring frame-perfect timing, and the last direction pressed persists as the player's intent until satisfied or replaced.
- **Catches:** queued cleared on any frame it cannot be satisfied. The game becomes unplayable in a way nobody can name — players report 'the controls feel laggy' and not one test fails. The long-corridor case additionally catches an expiry after N frames, which only reproduces in long corridors.

### `a reversal is taken immediately mid-corridor, without waiting for a tile centre`

**unit** · load-bearing

- **Why this type:** One corridor, one mid-tile position, one assertion. The rule is an explicit exception to the tile-centre rule, so it must be stated on its own or it will be quietly lost in a refactor that 'simplifies' turning.
- **Measures:** That the opposite of the current facing is applied at any pixel, not only at a centre.
- **Oracle:** Arcade behaviour: Pac-Man turns around instantly wherever he stands; only perpendicular turns wait for the corridor to open.
- **Catches:** Reversal deferred to the next tile centre, adding up to seven pixels of lag to every about-face and making ghost evasion feel wrong in exactly the moments it matters.

### `an actor moving more than one pixel in a frame still turns at the tile centre it passed through`

**unit** · load-bearing

- **Why this type:** Unit at a speed above one pixel per frame. Phrased as behaviour rather than as 'the turn policy is consulted once per pixel', deliberately: asserting a call count would pin the implementation and block every future refactor, which the charter names as a defect. The observable consequence is identical and survives a rewrite.
- **Measures:** Position and facing after a single frame whose step crosses a junction centre.
- **Oracle:** Arcade behaviour: turns land on the tile centre regardless of speed, because movement is resolved pixel by pixel within the frame.
- **Catches:** A frame-granular mover that evaluates the turn only at the end of the frame, so at high speed the actor sails past junctions. It would appear only for Cruise Elroy Blinky and for eyes — the two fastest states — and present as 'ghosts get stuck circling late in a level'.

### `enteredTile names the tile newly entered this frame and is null when the actor stayed in the same tile`

**unit** · load-bearing

- **Why this type:** Two frames, two assertions, both branches pinned, because this single field is the entire channel through which eating happens. Worth noting in the test comment why the field is one tile and not a list: at every speed in the documented table the per-frame step is far below the 8-pixel tile size, so no actor can ever cross two boundaries in one frame.
- **Measures:** MoveResult.enteredTile on a boundary-crossing frame and on a frame that stays within the tile.
- **Oracle:** Stated contract of MoveResult: enteredTile is how a caller learns a pellet might have been eaten, without moveActor knowing that pellets exist.
- **Catches:** enteredTile reported every frame, so a pellet is re-eaten on each of the eight frames Pac-Man spends crossing its tile and the score inflates eightfold; or never reported, so nothing is ever eaten and the board never clears.

### `crossing the tunnel edge wraps the actor to the far side with the sub-pixel carry preserved`

**unit** · load-bearing

- **Why this type:** Unit asserting the exact position AND the exact carry after the wrapping frame. The carry is the part an implementation forgets, and only an exact assertion on it catches the omission — a position-only test passes while the bug ships.
- **Measures:** position and carrySubPixels immediately across the warp.
- **Oracle:** Arcade behaviour: the tunnel is continuous, so an actor's motion through it is unbroken and its accumulated sub-pixel remainder cannot be reset.
- **Catches:** The carry zeroed at the warp, costing a fraction of a pixel per transit. Over a level, ghosts and Pac-Man drift out of the phase relationship every documented arcade pattern depends on.

### `no sequence of directions and speeds ever leaves an actor inside a wall`

**property** · guard

- **Why this type:** The one safety invariant of the whole movement engine, stated over arbitrary input sequences. fast-check generates hundreds of direction and speed sequences and shrinks any violation to a minimal reproduction, which is worth far more than a dozen hand-written corridors. Flagged as a guard honestly: an actor that never moves is never in a wall, so it must be read together with the load-bearing movement tests above it.
- **Measures:** kindAt(tileOf(actor)) after every step of every generated run.
- **Oracle:** Stated invariant of moveActor: an actor's position is always on a tile walkable for its permissions.
- **Catches:** A turn applied mid-pixel that places the actor inside a wall for a single frame before the next step corrects it. Invisible on screen, but it puts Pac-Man's tile inside a wall on exactly the frame collision is evaluated, producing deaths nobody can reproduce.

### `Pac-Man's turn policy takes the queued direction the instant it is legal, keeps facing when it is not, and keeps facing when nothing is queued`

**unit** · load-bearing

- **Why this type:** The policy is a pure function of a TurnContext, so all three contexts can be built by hand with no maze traversal and no mover. Testing it only through moveActor would conflate two rules and make any failure ambiguous about which one broke. The null-queued case is a guard on its own (a stub returning ctx.actor.facing passes it) but belongs beside its two load-bearing siblings.
- **Measures:** The direction returned for a legal queued turn, an illegal queued turn, and a null queue.
- **Oracle:** Arcade behaviour: player input is intent — applied as soon as the corridor allows, never discarding the current heading in the meantime, and releasing the joystick does not stop Pac-Man.
- **Catches:** Returning the queued direction unconditionally, so an illegal turn stops Pac-Man dead at a wall instead of letting him carry on; or defaulting the direction when no key is held, so he halts or veers every time the player lets go.

### `driving an actor along the classic maze's tunnel row exits one side and re-enters the other on the same row`

**integration** · load-bearing

- **Why this type:** Integration, because it is the only test that runs the real 28x31 board through parseMaze, the real tunnel row, wrapPosition and moveActor together. The unit tests each prove a piece against a fixture; this proves the pieces were wired to the SAME tunnel row. It stays pure core, so it costs microseconds and does not belong higher up the pyramid.
- **Measures:** Row and column before and after a full transit, and that no frame during the transit reported blocked.
- **Oracle:** Arcade behaviour: the warp corridor on the tunnel row documented in docs/ARCADE-REFERENCE.md carries an actor from one edge of the board to the other without interrupting movement.
- **Catches:** A tunnel row constant that disagrees between the parser and the wrap logic. Every unit test passes on its own fixture, and in the real game Pac-Man walks into an invisible wall at the tunnel mouth — the classic bug that only an integration test catches.

---

## ghosts-rules

### `is frightened while the fright timer is running, even for a ghost still inside the house, and not on the frame it reaches zero`

**unit** · load-bearing

- **Why this type:** isFrightened is a one-line predicate over a number; a unit is the cheapest type that fully exercises it. Reaching it through a tick would hide which of the timer, the phase or the pipeline was wrong.
- **Measures:** That fright is modelled as a timer orthogonal to GhostPhase rather than as a phase of its own: a ghost with phase InHouse and frightenedFramesLeft > 0 is frightened, and the same ghost at frightenedFramesLeft === 0 is not.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: a power pellet turns every ghost blue including ones still in the house. The absence of a Frightened phase follows from that fact, not from a design preference.
- **Catches:** Someone models fright as GhostPhase.Frightened. Ghosts in the house stay pink while the rest turn blue, and every phase switch statement now has to remember to restore the phase the ghost had before, which is where the 'ghost forgets it was Eyes' bug comes from.

### `blinky targets pac-man's tile exactly, whichever way pac-man is facing`

**unit** · load-bearing

- **Why this type:** A pure Tile-in/Tile-out function. Unit is the only type that can state the rule without also asserting movement, and it lets the facing-invariance be a second assertion in the same test rather than a second fixture.
- **Measures:** blinkyTarget returns the pacmanTile from TargetContext unchanged, and returns the identical tile for all four values of pacmanFacing.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: Blinky's chase target is Pac-Man's current tile. His rule reads position only — facing is Pinky's and Inky's input, never his.
- **Catches:** Blinky is given a one-tile lead 'so he feels smarter'. He then overshoots at corners and the whole difficulty curve of level 1 changes, with no other test noticing.

### `pinky targets four tiles ahead of pac-man when pac-man faces left, right or down`

**unit** · load-bearing

- **Why this type:** Pure function; three facings are three cheap cases in one table-driven unit with expect.assertions(3) to stop the loop passing vacuously. An integration test would need three whole game states to say the same thing.
- **Measures:** pinkyTarget offsets pacmanTile by four tiles along toUnitVector(facing) for the three non-up facings.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: Pinky targets the tile four ahead of Pac-Man's facing.
- **Catches:** An off-by-one (three ahead, or four pixels instead of four tiles). Pinky stops cutting Pac-Man off at junctions and the game becomes noticeably easier — a change nothing else in the suite can see.

### `pinky targets four up AND four left when pac-man faces up, reproducing the original hardware's overflow`

**unit** · load-bearing

- **Why this type:** This is a single arithmetic quirk. It needs its own named unit, separate from the other three facings, precisely so the test name can carry the citation and warn the next reader that the oddity is deliberate.
- **Measures:** pinkyTarget for facing up returns { col: pac.col - 4, row: pac.row - 4 } rather than { col: pac.col, row: pac.row - 4 }.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: the original's position-offset routine added the up-vector to both axes, so 'four ahead' while facing up is also four to the left. Documented ROM behaviour, not our invention.
- **Catches:** A future reader 'fixes the bug', Pinky's ambush geometry changes on every upward corridor, and the reproduction of a known arcade quirk is silently lost. This is the test whose NAME does most of the work.

### `inky doubles the vector from blinky through the tile two ahead of pac-man, and that pivot carries the same up-overflow`

**unit** · load-bearing

- **Why this type:** Pure two-input geometry. A unit can hand-place Blinky and Pac-Man to make the doubling arithmetic obvious; through the game it would take a contrived state and the failure would not say which half was wrong.
- **Measures:** inkyTarget computes pivot = pacTile + 2*facing (with the up case offset on both axes), then returns pivot + (pivot - blinkyTile).
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: Inky's target is the vector from Blinky to the tile two ahead of Pac-Man, doubled — and the pivot uses the same offset routine as Pinky's, so it inherits the up-overflow.
- **Catches:** The vector is applied from Pac-Man instead of from Blinky, or not doubled. Inky becomes a second Blinky and the pincer behaviour that makes him distinctive disappears while every other ghost test stays green.

### `inky's target is returned unclamped when the doubled vector lands off the board`

**unit** · load-bearing

- **Why this type:** A boundary case of one pure function. Cheap here; through the pipeline it would be a rare emergent situation you cannot reliably set up.
- **Measures:** A configuration whose doubled vector gives a negative column or a row past MAZE_ROWS returns that out-of-range Tile rather than a clamped one.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: the original does not clamp ghost targets. An unreachable target is legal — the ghost simply steers toward it and never arrives, which is what produces Inky's characteristic wide loops.
- **Catches:** Someone adds a clamp 'for safety'. Inky's off-board targets get pinned to a corner, he starts behaving like a scattering ghost mid-chase, and the bug is invisible until you watch him for a minute.

### `clyde chases pac-man's tile beyond eight tiles and retreats to his scatter corner at exactly eight tiles and closer`

**unit** · load-bearing

- **Why this type:** A threshold rule with three cases (above, exactly at, below). Three unit calls pin the comparison operator; an integration test would exercise one arbitrary distance and leave the > vs >= question open.
- **Measures:** clydeTarget returns pacmanTile when squaredDistance > 64, and SCATTER_CORNERS.clyde when squaredDistance === 64 and when it is below 64.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: Clyde chases while further than eight tiles from Pac-Man and reverts to his corner within eight. Compared as squared distance (64) because the arcade never takes a square root.
- **Catches:** A > written as >= (or the comparison done in tiles against 8 while the distance is squared). Clyde either never runs away or never chases, and his 'cowardly' personality — the one thing that distinguishes him — is gone.

### `each ghost's scatter corner is its arcade coordinate and sits outside the walkable maze`

**unit** · load-bearing

- **Why this type:** Pure data plus one query against ARCADE_MAZE. A unit pins the constants; nothing more expensive can add information, since the interesting consequence (ghosts circle rather than arrive) is already implied by unwalkability.
- **Measures:** SCATTER_CORNERS keyed by GhostId equals the four tabulated coordinates, and isWalkable(ARCADE_MAZE, corner, false) is false for all four.
- **Oracle:** docs/ARCADE-REFERENCE.md's scatter-corner table, one row per ghost, each cited to the original board.
- **Catches:** A corner moved one tile into a corridor. The ghost reaches it, stops steering coherently, and the scatter loop that lets a skilled player predict ghost positions turns into a jitter — a behavioural bug with no crash and no other failing test.

### `targetFor dispatches on phase before personality: scatter uses the corner and eyes head for the house door`

**unit** · load-bearing

- **Why this type:** This is a dispatch contract, not maths. A unit with a stubbed personality assertion keeps the four targeting rules from being re-tested here — each rule is already pinned in its own file, and re-asserting it would double the cost of every future change.
- **Measures:** For GlobalMode.Scatter targetFor returns the ghost's corner regardless of Pac-Man's position; for phases Eyes and EnteringHouse it returns maze.houseDoorTile; only for hunting does it delegate to the personality.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: during scatter every ghost heads for its fixed corner; an eaten ghost's eyes navigate to the house door irrespective of mode or personality.
- **Catches:** Personality is consulted before phase, so a frightened-then-eaten Blinky's eyes chase Pac-Man instead of going home, and the eyes never re-enter the house — the game silently loses a ghost for the rest of the level.

### `chooses the legal neighbour whose tile is nearest the target by squared distance`

**unit** · load-bearing

- **Why this type:** The core decision rule, isolated from movement and from targeting. A hand-drawn crossroads fixture from tiny-maze makes the right answer obvious by inspection; running it through ghost-system would add a maze, a speed and a frame for no extra information.
- **Measures:** At a crossroads with a target up-and-right, chooseDirection returns the direction whose neighbour tile minimises squaredDistance to the target.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: at each tile centre a ghost looks one tile ahead down each legal exit and takes the one nearest its target in straight-line distance.
- **Catches:** Distance measured from the ghost's own tile instead of from each candidate neighbour, which makes every candidate tie and collapses all four ghosts onto the tie-break order — they move identically and the AI looks broken without any test failing.

### `breaks an exact distance tie as up, then left, then down, then right`

**unit** · load-bearing

- **Why this type:** A determinism rule. The unit deliberately imports ALL_DIRECTIONS and derives the expectation from it, so reordering that array fails HERE — at the rule that depends on the order — rather than in some distant replay test.
- **Measures:** In a fixture where two (and separately three) exits are exactly equidistant from the target, the returned direction is the earliest of them in ALL_DIRECTIONS order.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: the original evaluates candidate directions in the fixed order up, left, down, right and keeps the first strict improvement, so ties resolve to the earliest. Right is never preferred over an equal alternative.
- **Catches:** A tie resolved by array iteration order that someone later changes, or by Object.keys. Two runs of the same replay diverge at the first tie, and every committed replay fixture starts failing for reasons nobody can localise.

### `takes the reversal in a dead end rather than throwing when it is the only legal exit`

**unit** · load-bearing

- **Why this type:** A totality case for one pure function. A unit can construct the dead end directly; waiting for a ghost to wander into one during an integration test would be flaky and slow.
- **Measures:** In a dead-end tile where the only non-wall neighbour is behind the ghost, chooseDirection returns opposite(facing) instead of throwing or returning the current facing into a wall.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: the no-reversal rule is a preference applied to the candidate list, not an absolute. A ghost that enters a dead end comes back out. The real board has such pockets around the ghost house.
- **Catches:** The reversal is filtered unconditionally, the candidate list comes back empty, and the game throws mid-frame (or the ghost walks into a wall and freezes). Only reachable on specific tiles, so it ships and crashes in front of a player.

### `never returns the reversal, a direction into a wall, or up on a no-up tile, for any maze, target and facing`

**property** · load-bearing

- **Why this type:** Three invariants that must hold for every input, not for the handful a developer thinks of. fast-check generates the combinations and shrinks a failure to the smallest maze and target that break it — a job example-based tests cannot do, and the reason the no-up quirk gets stated here rather than as a fourth hand-written case.
- **Measures:** Over generated tiny-maze fixtures, target tiles and facings: the result is always in walkableNeighbours, is never opposite(facing) unless it is the sole option, and is never Direction.Up when the ghost's tile is in maze.noUpTiles.
- **Oracle:** The three stated invariants of the arcade decision rule in docs/ARCADE-REFERENCE.md — no mid-corridor reversal, no walking into walls, and the four tiles where up is forbidden by the original hardware.
- **Catches:** A no-up tile handled on three of the four tiles, or a reversal filter that only works when exactly two exits exist. Hand-written examples happen to miss the broken case; the generator does not.

### `a frightened ghost consumes exactly one rng draw per decision, and the same script produces the same route twice`

**unit** · load-bearing

- **Why this type:** Determinism is a property of the Rng call count, which only a scripted Rng can observe. createScriptedRng throws when exhausted, so 'exactly one draw' becomes an assertion rather than a hope — no spies, no mocking of the function under test.
- **Measures:** With a script of exactly one value, one call to chooseFrightenedDirection succeeds and a second call throws 'script exhausted'; and replaying the same script yields an identical sequence of directions.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: a frightened ghost picks pseudo-randomly among its legal exits at each tile centre — one decision, one draw. The determinism requirement comes from this repo's replay contract (src/core/game/replay.ts).
- **Catches:** An extra draw for a discarded candidate, or a draw taken every frame instead of every decision. Every committed replay fixture desynchronises the moment a power pellet is eaten, and the resulting bug report is 'the replay is wrong sometimes'.

### `a frightened ghost only ever turns down a direction that is legal from its current tile`

**property** · load-bearing

- **Why this type:** The randomness is what makes example-based coverage weak here: a single scripted value exercises one branch of the modulo. A property over generated draw values and mazes covers all of them, including the value that maps to an index one past the end.
- **Measures:** For any tiny-maze tile and any Rng value in [0,1), the returned direction is a member of the legal set passed in.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: a frightened ghost still obeys the walls; only its preference becomes random.
- **Catches:** An off-by-one in mapping the draw to an index — nextInt(legal.length + 1), or Math.round instead of floor — returning undefined on the boundary draw. Under noUncheckedIndexedAccess that is a type error or a crash, and it fires roughly one decision in a thousand: exactly the kind of bug that reaches production.

### `selects the tunnel, frightened, eyes or elroy speed row from the level spec, with eyes fastest and tunnel slowest`

**unit** · load-bearing

- **Why this type:** Pure selection over a record. A unit asserts against the LevelSpec fields rather than raw integers, so the test states the SELECTION rule and level-table.test.ts stays the single owner of the numbers — no duplicated constants to drift.
- **Measures:** ghostSpeed returns speedSubPixels(spec.ghostTunnelSpeed) on a Tunnel tile, spec.ghostFrightSpeed while frightened, the eyes speed in the Eyes phase, and spec.elroy1Speed/elroy2Speed for Blinky at stages 1 and 2; plus the ordering eyes > base > fright > tunnel.
- **Oracle:** docs/ARCADE-REFERENCE.md's per-level speed table: ghosts crawl in the tunnel, slow down when frightened, and return to the house as eyes faster than they ever move alive.
- **Catches:** Precedence between fright and tunnel decided the wrong way round, so a frightened ghost in the tunnel is uncatchable — or Elroy Blinky ignoring his boost, which quietly removes the entire late-level difficulty ramp.

### `at level 1 releases pinky at 0 dots, inky at 30 and clyde at 60, always in that order`

**unit** · load-bearing

- **Why this type:** The house rules are pure arithmetic over counters. A unit can jump straight to 29 and 30 dots; reaching 60 dots through the pipeline would mean simulating a real minute of play to assert one integer.
- **Measures:** releaseDecision names pinky at 0, names nobody for inky at 29 and names inky at 30, names clyde at 60 — and never names a later ghost before an earlier one has left.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: level-1 personal dot limits are Pinky 0, Inky 30, Clyde 60, and the house releases strictly in that order.
- **Catches:** Thresholds compared with > instead of >=, so every ghost leaves one dot late — or all three released together the instant their counters pass, which turns the opening seconds of level 1 into an unwinnable four-ghost swarm.

### `after a life is lost the global dot counter's 7, 17 and 32 thresholds replace the personal counters`

**unit** · load-bearing

- **Why this type:** A mode switch inside one module, driven by a flag. Unit lets both worlds be set up side by side in one file; an integration test would prove the switch happened but not that the personal counters stopped being consulted.
- **Measures:** With the global counter active, releases happen at 7, 17 and 32 global dots, and a ghost whose personal counter is already past its own limit is still not released early.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: on losing a life the machine switches to a global counter with limits 7, 17 and 32, and personal counters are ignored until it is deactivated.
- **Catches:** Both counters left live, so after a death ghosts pour out at whichever threshold fires first. The post-death re-entry — the moment a player is most vulnerable — becomes far harsher than the original, and no other test looks at it.

### `releases the longest-waiting ghost after four seconds with no dot eaten, whatever the counters say`

**unit** · load-bearing

- **Why this type:** A timer rule expressed in frames. A unit advances the counter directly; an integration test would have to hold Pac-Man still for 240 real frames to reach the same assertion.
- **Measures:** With no dot eaten for the documented number of frames, releaseDecision names the earliest ghost in GHOST_ORDER still in the house, and the timer resets when a dot is eaten.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: if Pac-Man eats nothing for four seconds (three from level 5), the ghost with the highest release priority still in the house is released regardless of dot counters.
- **Catches:** The rule omitted entirely. A player who parks in a corner without eating faces one ghost forever — the deadlock the arcade added this timer to prevent — and every dot-counter test still passes.

### `blinky enters cruise elroy stage 1 and stage 2 at the level's dots-remaining thresholds`

**unit** · load-bearing

- **Why this type:** A two-step threshold function over one integer. Asserting on both sides of each threshold is four cheap unit calls; an integration test would give one sample and leave the comparison operators unpinned.
- **Measures:** elroyStage returns 0 one dot above spec.elroy1DotsLeft, 1 at it, 1 one dot above spec.elroy2DotsLeft, and 2 at it.
- **Oracle:** docs/ARCADE-REFERENCE.md's per-level Elroy table (elroy1DotsLeft / elroy2DotsLeft), read as 'dots REMAINING', not dots eaten.
- **Catches:** The threshold read as dots eaten rather than dots remaining. Blinky speeds up at the start of the level and calms down at the end — precisely inverted, and still 'working' enough that no crash or other test reveals it.

### `suspends cruise elroy while any ghost is still inside the house`

**unit** · guard

- **Why this type:** An easily-omitted qualifier on a rule already tested above. It gets its own named unit so that deleting the qualifier produces a failure with a self-explaining name rather than a subtly faster Blinky.
- **Measures:** With dots remaining below the stage-1 threshold but Clyde still in phase InHouse, elroyStage returns 0; the same state with the house empty returns the stage.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: Elroy mode is suspended while any ghost remains in the house and resumes when the last one leaves.
- **Catches:** A future refactor drops the house check. Blinky goes Elroy immediately after a death — while the other ghosts are still penned — and the level becomes brutally hard for reasons no bug report will ever articulate. This is a GUARD: a do-nothing stub returning stage 0 passes it, and it only earns its keep once the stage rule above is implemented. That pairing is worth showing.

### `level 1 runs scatter 7s, chase 20s, scatter 7s, chase 20s, scatter 5s, chase 20s, scatter 5s, then a chase that never ends`

**unit** · load-bearing

- **Why this type:** Table data. A unit compares the whole waves array in one assertion, including the final phase's null duration, which is the case a spot-check would miss.
- **Measures:** levelSpec(1).waves equals the eight-entry sequence with the documented frame durations, and the last entry's durationFrames is null.
- **Oracle:** docs/ARCADE-REFERENCE.md's level-1 wave table, converted from seconds at FRAME_MS.
- **Catches:** A missing final entry, so the schedule runs off the end of the array and either throws or wraps back to scatter. Ghosts wander to their corners forever in the late game and the level becomes unloseable.

### `requires a reversal on exactly the frame a wave changes and on no other frame`

**unit** · load-bearing

- **Why this type:** An edge-trigger, and edge-triggers are where level-vs-edge confusion lives. A unit can step the clock frame by frame across the boundary — frame N-1, N, N+1 — which is the only way to distinguish an edge from a level.
- **Measures:** advanceModes returns reversalRequired false on the frame before the flip, true on the flip frame, and false on the frame after.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: a scatter/chase transition forces every ghost to reverse — once, at the transition.
- **Catches:** reversalRequired reported as a level rather than an edge. Every ghost reverses on every frame of the new mode and they vibrate on the spot — dramatic on screen, but the arithmetic is 'nearly right' and nothing else catches it.

### `advances the wave clock during normal play and freezes it entirely while ghosts are frightened`

**unit** · load-bearing

- **Why this type:** Two behaviours that must be asserted together: 'does not advance' alone would pass against a clock that never advances at all. One unit, two phases, one honest assertion — a direct illustration of why a negative-only assertion is a weak test.
- **Measures:** N frames with frightenedFramesLeft === 0 advance the wave elapsed count by N; N frames with the fright timer running leave it unchanged, and it resumes from the same value afterwards.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: the scatter/chase timer is paused for the duration of fright and resumes where it stopped.
- **Catches:** Fright running alongside the schedule. Every power pellet silently eats several seconds of the player's scatter time, so the late waves arrive early — a drift of exactly the sort no single-frame test can see.

### `reports frightened ended on the single frame the timer reaches zero and never again`

**unit** · load-bearing

- **Why this type:** Another edge-trigger, and the one every consumer downstream depends on (audio, the ghost combo reset, the speed row). Stepping past zero for several frames in one unit is the cheapest way to prove the edge does not repeat.
- **Measures:** Stepping the fright timer from 1 to 0 reports frightenedEnded once; five further frames at 0 report it zero times.
- **Oracle:** Edge-trigger contract of the GameEvent vocabulary in src/core/game/game-event.ts, applied to the arcade rule that fright has a definite end.
- **Catches:** The event emitted every frame while the timer sits at zero. The siren restarts sixty times a second, the ghost combo ladder resets continuously, and the audio idempotence test in another area fails with a cause nobody can trace back here.

### `level 21's row is used for level 21 and every level above it, and levels 0 and below clamp to level 1`

**unit** · load-bearing

- **Why this type:** Table lookup plus two clamps. A unit compares levelSpec(21) field by field against the reference row — the citation belongs in the test name — and covers both ends of the domain in the same file so the clamp lives in exactly one place.
- **Measures:** levelSpec(21) matches every documented field; levelSpec(256) deep-equals levelSpec(21) except for its level field; levelSpec(0) and levelSpec(-3) return level 1's row.
- **Oracle:** docs/ARCADE-REFERENCE.md's per-level table, in which levels 21 and up all share level 21's parameters, plus the total-function contract stated in the architecture (no other module writes Math.min(level, 21)).
- **Catches:** An unclamped index returning undefined at level 22, which under noUncheckedIndexedAccess crashes the game for anyone good enough to get there — the classic bug nobody finds because nobody plays that far in testing.

### `gives zero frightened frames from level 19 on, so a power pellet still scores and still reverses but nobody turns blue`

**unit** · load-bearing

- **Why this type:** One field across a boundary: levels 18, 19 and 20. Cheap as a unit, and it deliberately stops at the table — the consequence of a zero-length fright flowing through eat-system is a separate integration test, so a failure tells you which of the two is wrong.
- **Measures:** levelSpec(18).frightenedFrames > 0 and levelSpec(19).frightenedFrames === 0, likewise for 20.
- **Oracle:** docs/ARCADE-REFERENCE.md's per-level table: fright time reaches zero at level 19. The pellet is still eaten and still forces a reversal; only the blue period is gone.
- **Catches:** A zero here treated as 'no data' and defaulted to a level-1 fright. Level 19 becomes easier than level 18, inverting the difficulty curve at exactly the point the original made it hardest.

### `scores a plain pellet at 10, a power pellet at 50 and a level 1 cherry at 100`

**unit** · load-bearing

- **Why this type:** Constants. A unit is the only sensible home; asserting them through gameplay would make the arithmetic of scoring hostage to movement and collision both working first.
- **Measures:** POINTS.pellet is 10, POINTS.powerPellet is 50, and levelSpec(1).fruitPoints is 100 with fruit kind cherry.
- **Oracle:** docs/ARCADE-REFERENCE.md's scoring table, which is where the charter's example 'power pellet is 50, not 40' comes from.
- **Catches:** A power pellet worth 40. Every score in the game is wrong by a slowly growing amount, the extra-life threshold arrives at the wrong moment, and the committed replay fixtures — which assert exact scores — start failing without saying why.

### `awards 200, 400, 800 then 1600 for the first through fourth ghost eaten in one fright`

**unit** · load-bearing

- **Why this type:** A pure ladder function over one integer. Four unit calls with expect.assertions(4) pin all four rungs; producing four ghost-eats inside a running game to assert the same thing would be an order of magnitude more setup for less clarity.
- **Measures:** ghostPoints(0..3) returns 200, 400, 800, 1600.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: the ghost score doubles with each ghost eaten during a single power pellet, capping at 1600 for a full chain of four (3000 for the set).
- **Catches:** A linear ladder (200/400/600/800). The 3000-point four-ghost chain — the single biggest scoring opportunity in the game and the thing skilled play optimises for — quietly stops existing.

### `states its result for an impossible fifth ghost in one fright rather than leaving the input undefined`

**unit** · guard

- **Why this type:** A totality question about a pure function, unanswerable anywhere else: the fifth ghost cannot be produced through the game, so only a direct call can define the contract.
- **Measures:** ghostPoints(4) returns the documented value (the 1600 cap) instead of undefined or NaN.
- **Oracle:** The totality contract required by noUncheckedIndexedAccess in this codebase: a table lookup must define its out-of-range behaviour. The chosen value follows the arcade cap of 1600.
- **Catches:** An array index off the end returning undefined, which then reaches addScore and makes the score NaN — irrecoverably, since NaN + anything is NaN. GUARD: a do-nothing stub returning 0 also 'defines' the behaviour and passes, so this test only starts protecting anything once the ladder above is real. It is worth keeping precisely because it documents an input the type system permits and the game cannot reach.

### `awards the extra life once, on the frame the score crosses 10000, and never again as the score keeps climbing`

**unit** · load-bearing

- **Why this type:** A crossing detector, which is only meaningfully testable by stepping across the threshold and then well past it. A unit does that in three calls with no game state at all.
- **Measures:** addScore from 9990 by 10 reports extraLifeAwarded true; a further addScore from 10000 upward reports false; and a single addScore that jumps from 9000 to 12000 in one go still reports true exactly once.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: one bonus life at 10000 points, awarded once per game.
- **Catches:** A predicate written as score >= 10000 rather than a crossing. The player gains a life on every subsequent scoring event and ends with ninety lives — and note the jump case: an exact === 10000 check misses the award entirely when a 1600-point chain leaps the threshold.

### `spawns the fruit at 70 and at 170 dots eaten, never a third time, and expires it after its documented lifetime`

**unit** · load-bearing

- **Why this type:** A small state machine over a dot count and a frame budget. A unit drives it directly through both spawns and the expiry; through the pipeline this would need 170 eaten pellets of setup to reach the second spawn.
- **Measures:** stepFruit reports fruitAppeared at exactly 70 and exactly 170 dots eaten and at no other count including 171 and beyond; an uneaten fruit reports fruitExpired on the last frame of its lifetime and is absent afterwards.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: the bonus item appears twice per level, at 70 and 170 dots eaten, and disappears after its documented on-screen time if not collected.
- **Catches:** A >= comparison spawning a fresh fruit on every dot past 70, or a fruit that never expires and sits on the board for the rest of the level collecting points whenever Pac-Man passes over it.

### `treats a shared tile as a collision: a frightened ghost is eaten and a hunting ghost catches pac-man`

**unit** · load-bearing

- **Why this type:** The resolution rule alone, with the ghost and Pac-Man placed on the same tile by hand. Keeping it a unit means the scoring ladder and the event emission — tested at the system level — cannot mask a fault in the rule itself.
- **Measures:** resolveCollision returns 'eaten' for a ghost with the fright timer running and 'caught' for a hunting ghost on the same tile, and 'nothing' when the tiles differ.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: collision is decided by tile occupancy, and the outcome depends solely on whether the ghost is currently blue.
- **Catches:** The two outcomes swapped, or fright read from a phase that does not exist (see the isFrightened test) so a frightened ghost kills Pac-Man. Power pellets become a death sentence — the most player-visible bug possible, and a unit catches it in a millisecond.

### `lets a ghost in the eyes phase pass straight through pac-man`

**unit** · guard

- **Why this type:** A third branch of the same pure rule, given its own name so the exemption is documented behaviour rather than an unexplained condition in a switch.
- **Measures:** resolveCollision with a ghost in phase Eyes on Pac-Man's tile returns 'nothing' — neither eaten nor caught.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: a pair of eyes returning to the house does not interact with Pac-Man.
- **Catches:** Eyes treated as a hunting ghost, killing Pac-Man on the way home — or as a frightened one, letting the player re-eat the same ghost for another 1600 points all the way to the door. GUARD: a stub returning 'nothing' for everything passes it, which is exactly why it must sit beside the load-bearing test above; alone it proves nothing.

### `never collides when pac-man and a ghost swap tiles in a single frame — faithful arcade pass-through`

**unit** · guard

- **Why this type:** The rule under test is that collision compares positions AFTER movement and does not interpolate the path. A unit stating the before and after tiles explicitly is the clearest possible statement of that; an integration test would depend on exact speeds lining up and would flake.
- **Measures:** Given a ghost and Pac-Man that exchange adjacent tiles between two frames, no frame exists in which they share a tile, so no collision is reported at either end.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: the original compares tile occupancy only, so a head-on swap at the right moment passes through. This is documented original behaviour, reproduced deliberately.
- **Catches:** Someone adds path-crossing detection to 'fix the bug'. Pac-Man now dies in situations where the arcade let him live, and the difference is invisible until a speedrunner notices. GUARD: a stub reporting no collision passes trivially — its value is entirely in the NAME, which tells the next reviewer this is intentional and must not be 'fixed'.

### `ends the game and reports the final score when the last life is lost`

**unit** · load-bearing

- **Why this type:** A branch of a small pure transition function. The unit pins the boundary (one life left versus none); the respawn path through the pipeline is covered separately at integration level.
- **Measures:** loseLife with lives 1 returns phase gameOver and a gameOver event carrying the current score; with lives 2 it returns the dying phase and lives 1.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: the game ends when the last life is lost; the score displayed is the score at that moment.
- **Catches:** An off-by-one giving the player a free fourth life, or a negative lives count that renders as -1 icons in the HUD and never reaches game over — the game becomes unloseable.

### `queues a reversal on all four ghosts when the mode system flips the wave`

**integration** · load-bearing

- **Why this type:** The behaviour IS the wiring: mode-schedule reports reversalRequired and mode-system must translate that into a field on every ghost. A unit on either half passes while the connection between them is missing. Built from state-builder, one system, no pipeline.
- **Measures:** Running mode-system on the frame a wave flips returns a state in which all four ghosts have reverseQueued true and emits one modeChanged event with the new mode and wave index.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: every ghost reverses direction on a scatter/chase transition.
- **Catches:** The flag set on the ghost the loop happened to end on, or on none of them. The reversal — the cue that tells a player the mode changed — never happens, and both the schedule unit test and the reversal-execution test still pass in isolation.

### `reverses a queued ghost at its next tile centre and clears the flag, while a ghost in the house ignores it`

**integration** · load-bearing

- **Why this type:** This spans the flag, the turn policy and the movement engine — three modules whose contract is only visible together. The in-house exemption rides along in the same test because it is the same rule's qualifier.
- **Measures:** A hunting ghost with reverseQueued true faces the opposite direction after reaching its next tile centre and has reverseQueued false; a ghost in phase InHouse keeps its position and its flag is not acted upon.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: reversal happens at the next decision point, not instantly mid-tile, and ghosts inside the house are exempt because they are not navigating the maze.
- **Catches:** Reversal applied immediately, teleporting a ghost's facing mid-corridor and letting it walk backwards out of a tile it has half entered — or an in-house ghost reversing into the house wall and jamming there permanently, which strands the release order behind it.

### `moves the ghosts in ghost order, consuming the rng stream in exactly that order`

**integration** · load-bearing

- **Why this type:** Nothing smaller can see this: the ordering is a property of the loop inside ghost-system, and its only observable consequence is which ghost got which random draw. A scripted Rng with four distinguishable values turns an ordering claim into an equality assertion.
- **Measures:** With all four ghosts frightened at a junction and a four-value scripted Rng, each ghost's resulting direction corresponds to the draw at its index in GHOST_ORDER.
- **Oracle:** The replay-determinism contract in src/core/game/replay.ts plus the fixed order pinned in src/core/ghost/ghost-id.ts: release, collision, Rng consumption and draw order are all GHOST_ORDER.
- **Catches:** Ghosts iterated with Object.values over the ghosts record, whose order a later refactor changes. Every committed replay fixture desynchronises, and because the divergence only appears during fright it looks intermittent — the hardest class of bug to diagnose, pinned here by an equality assertion.

### `sends an eaten ghost home as eyes and reports it returned when it reaches the house`

**integration** · load-bearing

- **Why this type:** A multi-frame journey across targeting, speed selection, movement and phase transitions. No unit sees the whole arc, and this is exactly the 'the parts each work but the sequence is wrong' case integration tests exist for.
- **Measures:** Starting from a ghost just eaten, stepping frames until arrival: the phase goes Eyes then EnteringHouse, the target is the house door throughout, and exactly one ghostReturnedHome event is emitted, after which the ghost is available for release again.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: an eaten ghost's eyes travel back to the house at high speed, regenerate there and re-enter play through the normal release rules.
- **Catches:** Eyes that arrive at the door but never transition, so the ghost hovers outside the house forever — the game loses a ghost per fright until none are left, and every single-frame test passes throughout.

### `emits exactly one ghost eaten event when the collision system runs twice in the same frame`

**integration** · load-bearing

- **Why this type:** Idempotence under the pipeline's double invocation is a property of collision-system's interaction with the state it returns. Only running it twice — as GAME_PIPELINE does — can show it, and phrasing it as 'exactly one event' rather than 'not two' keeps the assertion positive and therefore load-bearing.
- **Measures:** Running collision-system, threading its state forward, and running it again on the same overlap yields exactly one ghostEaten event across both runs, one score increment, and a chain index that advanced by one, not two.
- **Oracle:** The pipeline contract in src/core/game/pipeline.ts: collision runs after Pac-Man moves and again after the ghosts move, which is what reproduces the arcade pass-through — and it must be correct to run twice, not merely tolerated.
- **Catches:** Double scoring on any frame where Pac-Man and a ghost already overlap before the ghosts move: a 200-point ghost pays 400, the ladder skips a rung, and the four-ghost chain totals 6000. Every unit test of the collision rule stays green.

### `resets the ghost score ladder when fright ends, not when a ghost is eaten and not on a power pellet taken mid-fright`

**integration** · load-bearing

- **Why this type:** The reset lives in the seam between mode-system (which ends fright) and eat-system (which starts it). Three modules, one rule, and the two wrong answers are both plausible — precisely the confusion a unit on ghostPoints cannot resolve.
- **Measures:** Across a run of frames: eating two ghosts then a second power pellet still mid-fright continues the ladder at 800; letting the fright timer expire and starting a new one restarts it at 200.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: the ghost value resets when the frightened period ends, so a power pellet eaten while ghosts are already blue extends the period without restarting the ladder. Cited explicitly because this is the detail most secondary sources get wrong.
- **Catches:** The ladder reset on every power pellet. A player who chains a second pellet mid-fright loses several thousand points, and the scoring looks 'nearly right' — the kind of discrepancy only a replay fixture with an exact score would otherwise expose.

### `scores 50 and reverses the ghosts but starts no fright when a power pellet is eaten at level 19`

**integration** · load-bearing

- **Why this type:** The level table says frightenedFrames is 0; this test proves the zero survives the journey through eat-system into ghost state. A table unit cannot show that a zero is honoured rather than treated as 'unset' and defaulted.
- **Measures:** eat-system on a level-19 state at a power pellet tile: score +50, a powerPelletEaten event, every ghost's frightenedFramesLeft still 0, isFrightened false, and the reversal still queued.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: from level 19 a power pellet scores and reverses the ghosts but produces no blue period.
- **Catches:** A falsy-check (`if (spec.frightenedFrames)`) that silently substitutes a default, giving level 19 a full fright — or one that skips the reversal along with the fright, removing the only remaining benefit of a power pellet at high levels.

### `respawns after a death and switches the house to the global dot counter`

**integration** · load-bearing

- **Why this type:** life-system learns about the death only from the incoming events of an earlier system, and its effect lands in a different module's state (the house). That cross-module handoff is the thing being tested; a unit would have to fake both ends and prove nothing about the wiring.
- **Measures:** Given a pacmanCaught event in `incoming` with lives remaining: the phase becomes dying, actors return to their spawn tiles, lives decrease by one, one pacmanDied event is emitted, and house.globalCounterActive becomes true with the counter at zero.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: losing a life resets the actors and activates the global dot counter for the next life.
- **Catches:** The global-counter switch omitted, so after a death the house keeps using personal counters that are already satisfied and releases all three ghosts instantly — the house unit test in this same area passes because it was handed the flag directly.

### `starts the next level with the next level's spec when the board is cleared`

**integration** · load-bearing

- **Why this type:** Level progression is a handoff between the pellet field, level-system and startRound, with a specific rule about what survives. A unit on startRound alone would not show that the trigger fires on the right frame.
- **Measures:** With the pellet field empty, level-system emits levelCleared for the current level and produces a state at level+1 with a full 244-pellet board, reset ghosts and house counters, and a preserved score, high score and lives.
- **Oracle:** Arcade behaviour, docs/ARCADE-REFERENCE.md: clearing the board advances the level; score and lives carry over, everything positional resets. The 'what resets versus what persists' split is the startRound contract in src/core/game/new-game.ts.
- **Catches:** Score reset along with the board, wiping the player's run at every level transition — or levelCleared fired when only the plain pellets are gone while a power pellet remains, ending the level early and skipping points the player earned.

---

## audio-io

### `sirenTier steps up at each documented pellets-remaining threshold, and one pellet earlier does not`

**unit** · load-bearing

- **Why this type:** sirenTier is a total pure function from one integer to one cue. A unit test with a table of (remaining, expected) pairs straddling every boundary is the cheapest thing that can pin five thresholds; an integration test through tick would need a whole board eaten down to each threshold and would tell you nothing extra when it failed.
- **Measures:** The mapping from pellets remaining to AudioCue, asserted on BOTH sides of each of the four boundaries (e.g. threshold t -> tier n, t+1 -> tier n-1).
- **Oracle:** The arcade's five siren tiers, which climb as the board empties; the exact pellets-remaining thresholds are recorded with their citation in docs/ARCADE-REFERENCE.md. The test names the reference, not the implementation.
- **Catches:** An off-by-one in a `<` vs `<=` comparison: the siren changes pitch one pellet late all game. Nothing else in the suite listens to audio, so this ships silently and is only noticed by someone who knows the original by ear.

### `decideAudio starts the siren for the current pellet count when the round enters the playing phase`

**unit** · load-bearing

- **Why this type:** decideAudio is pure: (AudioState, GameState, events) -> (AudioState, commands). A unit test asserts a plain array of plain objects. Testing this through game-app would drag in a recording AudioOutput and a tick, and would still be checking this one decision.
- **Measures:** That the returned commands contain exactly one `play` of the tier matching the state's pellet count, with loop true, and that the returned AudioState records it as the live loop.
- **Oracle:** Stated design invariant of this module (slice s13): the siren is the ambient loop during play, and the tier is a function of the CURRENT pellet count — plus the arcade behaviour that the siren runs continuously while Pac-Man is alive.
- **Catches:** The game plays in silence, or starts tier 1 forever regardless of how empty the board is.

### `decideAudio emits no commands when nothing has changed since the previous frame`

**unit** · guard

- **Why this type:** Idempotence is a statement about two consecutive calls with the same inputs — a unit test can make that call twice in one line. No cheaper type exists, and no more expensive one would express it as clearly.
- **Measures:** Feeding decideAudio the state it just returned, with an empty event list, yields an empty command array (and an unchanged AudioState).
- **Oracle:** Stated design invariant: decideAudio is called every frame, so it must edge-detect loops rather than re-issue them. The rule is 'commands describe CHANGES in what is sounding'.
- **Catches:** The siren is re-`play`ed sixty times a second. On a real AudioContext that is sixty overlapping oscillators per second — an audible stutter or a rising drone, and eventually a stalled audio thread. It looks like a synth bug and is actually a decision bug.

### `eating a power pellet stops the siren and starts the frightened loop`

**unit** · load-bearing

- **Why this type:** A pure function reacting to one event. Unit. Doing it through the pipeline would couple this test to the eat-system's event shape and to fright timing, both of which are other slices' business.
- **Measures:** Given a powerPelletEaten (or frightenedStarted) event, the command list is exactly [stop siren-n, play frightened loop] and the AudioState's live loop becomes Frightened.
- **Oracle:** Arcade behaviour: the siren is replaced by the frightened warble for the duration of fright; docs/ARCADE-REFERENCE.md. Plus the module invariant that only one loop sounds at a time.
- **Catches:** The siren and the frightened loop play simultaneously — two loops layered forever, because nothing ever stops the first one.

### `when fright ends the siren resumes at the tier for the CURRENT pellet count, not the tier that was playing before`

**unit** · load-bearing

- **Why this type:** This is a one-line difference between two plausible implementations (restore a saved cue vs. recompute from state), and a unit test can construct the exact discriminating case: eat enough pellets during fright to cross a tier boundary.
- **Measures:** After frightenedEnded, with a pellet count that has crossed a threshold since fright began, the emitted play command names the higher tier.
- **Oracle:** Arcade behaviour: the siren tier is always a function of pellets remaining, so it never regresses; docs/ARCADE-REFERENCE.md. The 'restore what was playing' alternative is explicitly the wrong one.
- **Catches:** A saved-and-restored cue: after every power pellet the siren drops back to the pitch it had at the start of the level, so a nearly-cleared board sounds like a fresh one.

### `the retreating-eyes loop outranks the frightened loop while any ghost is Eyes, and hands it back when the last pair of eyes reaches the house`

**unit** · load-bearing

- **Why this type:** A priority rule between two loops, exercised with two hand-built states (one ghost in Eyes; then none). Unit, because the rule is a comparison over state, not an interaction. An integration test through collision + ghost systems would test those systems, not this precedence.
- **Measures:** With at least one ghost in the Eyes phase the live loop is Eyes; when that ghost returns home while fright is still running, the frightened loop resumes rather than the siren.
- **Oracle:** Arcade behaviour: the retreating-eyes sound overrides the fright warble until the eyes are home, then the fright sound returns for the remainder of the timer; docs/ARCADE-REFERENCE.md.
- **Catches:** Eating a ghost either silences everything until fright ends, or the eyes loop never stops — the most common real bug is 'first eyes home' clearing the loop while three ghosts are still travelling.

### `the chomp alternates between ChompA and ChompB on successive pellets`

**unit** · load-bearing

- **Why this type:** Alternation is state carried in AudioState across calls; a unit test threads the returned state into the next call, which is exactly how the app uses it. A component test through game-app would prove the same thing more slowly and with more moving parts.
- **Measures:** Three pelletEaten events in sequence produce ChompA, ChompB, ChompA, each as a one-shot (loop false) that does not disturb the running siren.
- **Oracle:** Arcade behaviour: the 'waka-waka' is two alternating blips, not one repeated sample; docs/ARCADE-REFERENCE.md.
- **Catches:** A monotonous single-pitch chomp — the single most recognisable sound in the game rendered wrong — or, worse, a chomp emitted as a loop that never stops.

### `a death emits stopAll before the death melody, and a game over leaves nothing looping`

**unit** · load-bearing

- **Why this type:** The assertion is about ORDER within one returned array, which a unit test reads directly. A recording AudioOutput (component) would let order be observed too, but only after adding the app layer, and the ordering decision is made here.
- **Measures:** The command array for a pacmanDied event is [stopAll, play Death (loop false)] in that index order, and after a gameOver event the returned AudioState.loop is null.
- **Oracle:** Arcade behaviour: everything cuts out at the moment Pac-Man is caught, leaving only the death jingle; and the attract/game-over screen has no siren. Stated as a module invariant in slice s13.
- **Catches:** The siren carries on under the death melody and keeps running through the game-over screen — the bug where the only way to stop the sound is to reload the page.

### `every AudioCue has a song filed under it whose cue field matches its key and which contains at least one note`

**unit** · load-bearing

- **Why this type:** Data-driven unit over Object.entries(SONGS), with expect.assertions(n) so an empty registry cannot pass by iterating nothing. The Record type already makes a MISSING cue a compile error; only a runtime test can catch a present-but-empty or mis-keyed entry.
- **Measures:** For each of the fourteen cues: SONGS[cue] exists, song.cue === cue, and its tracks contain at least one note.
- **Oracle:** Stated design invariant of slice s14: 'a cue with no tune is a compile error, not silence' — this test extends that guarantee to the cases the type cannot see (copy-pasted cue field, empty tracks array).
- **Catches:** A copy-pasted song object still carrying the previous cue's id, so requesting `eatFruit` plays the death melody; or a stub song with no notes that plays as silence and reads as 'the synth is broken'.

### `every note in every song is structurally valid: MIDI number in 0-127, positive duration, non-negative start`

**property** · guard

- **Why this type:** Stated as an invariant over the whole authored corpus rather than over one song, and run with fast-check-style exhaustion over the real data (every note of every track). Cheaper than per-song unit tests and it automatically covers songs added later — which is the point when the data is meant to grow.
- **Measures:** For all notes n in all tracks of all songs: 0 <= n.midi <= 127, n.durationTicks > 0, n.startTicks >= 0, 0 < n.velocity <= 1.
- **Oracle:** The MIDI specification's note-number range (0-127) and the Note type's documented contract in assets/music/song.ts (durations are counted in ticks and a note must last). External standard, not our code.
- **Catches:** A typo'd octave (midi 169) that midiToFrequency turns into an inaudible or speaker-damaging frequency, or a zero-length note that schedules an oscillator with start === stop and simply never sounds — a silent gap nobody can locate by ear.

### `no note in a monophonic track starts before the previous note has ended`

**property** · guard

- **Why this type:** An ordering invariant over sequences, checked across the whole corpus — the shape property tests are for. Writing it per-song would be fourteen near-identical unit tests, and none of them would cover the fifteenth song.
- **Measures:** For each track declared monophonic, sorting by startTicks, note[i].startTicks >= note[i-1].startTicks + note[i-1].durationTicks.
- **Oracle:** The definition of a monophonic voice (one note sounding at a time) plus the Track type's declared instrument contract — a musical fact, independent of the synth.
- **Catches:** Overlapping notes on a single-voice line: the arcade siren is one voice, so overlap produces a muddy chord instead of a melody, and on a real oscillator-per-note synth it produces audible beating.

### `every looping song's lengthTicks lands on a bar boundary so the loop seam falls on the beat`

**unit** · guard

- **Why this type:** A single arithmetic predicate over the handful of looping songs — a unit test with a filter. A listening test cannot be automated and a property test would add generation machinery for a fixed, tiny set.
- **Measures:** For each song whose cue is used as a loop (sirens, frightened, eyes): lengthTicks % (ticksPerBeat * beatsPerBar) === 0, and lengthTicks >= the end of its last note.
- **Oracle:** Musical convention, made explicit in slice s14: a loop that restarts mid-bar drifts against the beat. Also the stated requirement that note durations are counted in the same clock the game runs on, so a tune cannot drift against gameplay.
- **Catches:** A siren loop that is 3.5 beats long: every repeat shifts the pulse, and after ten seconds the sound is arrhythmic — a bug that is obvious to a listener and invisible to every other test.

### `midiToFrequency(69) is exactly 440 Hz and middle C is 261.63 Hz within a stated tolerance`

**unit** · load-bearing

- **Why this type:** Pure maths on a number. Unit is the only sane type. Note the deliberate mix: one exact assertion (the tuning anchor must be exact, not approximately 440) and one toBeCloseTo with a named tolerance, because equal temperament gives C4 an irrational value.
- **Measures:** The absolute tuning reference and one derived note, which together pin both the constant and the exponent.
- **Oracle:** Equal temperament with A4 = 440 Hz (ISO 16): f(n) = 440 * 2^((n-69)/12). An external standard that predates this codebase by a century.
- **Catches:** A synth tuned to A = 432 or an off-by-one in the note offset, so every tune plays a semitone flat. It sounds 'fine but wrong' and no one can say why.

### `raising a note by twelve semitones doubles its frequency, for every MIDI note in range`

**property** · load-bearing

- **Why this type:** The octave relation is a universally quantified statement, so fast-check states it directly over the whole domain instead of at three sampled notes. It also shrinks to the smallest failing note, which points straight at the exponent.
- **Measures:** For all n in [0,115]: midiToFrequency(n+12) === 2 * midiToFrequency(n), within floating-point tolerance.
- **Oracle:** The definition of an octave in equal temperament — a doubling of frequency. External musical fact.
- **Catches:** A linear or lookup-table implementation that happens to be right at A4 and drifts everywhere else: the low notes of the death melody land between semitones.

### `scheduleSong converts ticks and BPM into seconds: a quarter note at 120 BPM lasts half a second`

**unit** · load-bearing

- **Why this type:** scheduleSong is the pure half of the synthesiser — the interesting half — so it can be tested with no AudioContext at all. Pushing this into the web-audio component test would hide an arithmetic bug behind a recording fake.
- **Measures:** For a two-note song, the returned ScheduledTone start and duration values in seconds, and the frequency in hertz for each note.
- **Oracle:** Musical arithmetic: seconds = (ticks / ticksPerBeat) * (60 / beatsPerMinute). A definition, not a preference.
- **Catches:** A tempo off by a factor of the ticks-per-beat: the intro jingle plays sixteen times too fast (a click) or sixteen times too slow (a drone). Also the class of bug where duration is right but start times accumulate rounding drift.

### `a looping song's second repeat starts exactly one song length in seconds after the first`

**unit** · load-bearing

- **Why this type:** Loop seam arithmetic is one function call with a startSeconds offset — a unit test. The alternative, listening for a gap in a real AudioContext, is untestable in CI and is precisely the bug this catches.
- **Measures:** scheduleSong(song, 0) and scheduleSong(song, songLengthSeconds) produce tone lists whose start times differ by exactly songLengthSeconds, with no gap and no overlap at the seam.
- **Oracle:** The definition of a seamless loop, plus the lengthTicks field's stated meaning (the song's full length, including trailing rest, not the end of its last note).
- **Catches:** Scheduling the repeat from the last note's END instead of from lengthTicks: every loop iteration arrives early, the siren speeds up over a level, and the trailing rest disappears.

### `playing a cue schedules one oscillator per note at the expected frequency and start time`

**component** · load-bearing

- **Why this type:** Component with a recording fake AudioContext, mirroring the recordingSurface pattern already in render-scene.test.ts. CI has no speakers, so 'did it sound right' is unobservable; a recording fake makes the SCHEDULE observable and asserts it exactly. jsdom does not implement Web Audio, so a real context is not an option, and an e2e test could only prove that no exception was thrown.
- **Measures:** The exact sequence of createOscillator/connect/start/stop calls, their frequency values and their scheduled times, against the song's notes.
- **Oracle:** assets/music note data (the authored song) combined with the equal-temperament and tempo conversions already pinned by the note-frequency and scheduleSong tests. The expectation is derived from the data, never from the synth.
- **Catches:** Notes scheduled at the wrong absolute time because currentTime was ignored — every note piles onto the same instant and the tune becomes one chord.

### `stopping a cue silences the nodes it started and leaves another playing cue untouched`

**component** · load-bearing

- **Why this type:** Node lifetime is only observable through the fake context's records, so component. Written so it is not vacuous: it first asserts that playing created nodes, THEN that stop silenced exactly those. A test that merely asserted 'no live nodes' would pass against a synth that never plays anything.
- **Measures:** After play(siren) and play(frightened), stop(siren) leaves the siren's oscillators stopped/disconnected and the frightened oscillators still live; a later stopAll after several loop repeats leaves none live at all.
- **Oracle:** The AudioOutput contract stated in src/platform/audio/audio-output.ts: a stop is total for its cue and inert for every other cue. A design invariant the core's command vocabulary depends on.
- **Catches:** Leaked oscillator nodes: after a few power pellets the tab accumulates hundreds of live nodes, the audio thread saturates and the game's frame rate collapses. Or stop(siren) killing the chomp too, so eating goes silent after the first power pellet.

### `layout places tile (0, 0) at the playfield origin, below the HUD rows`

**unit** · load-bearing

- **Why this type:** A coordinate conversion — arithmetic on two numbers. Unit. The expensive alternative is the visual baseline, which would tell you the whole maze is shifted but not by how much or why.
- **Measures:** tileToScreen({col:0,row:0}) equals the documented playfield origin, and tile (27,30) lands inside the 224x288 canvas rather than off its edge.
- **Oracle:** The arcade's screen layout: a 28x31 playfield of 8px tiles inside a 224x288 display, with the score rows above and the lives/fruit row below; docs/ARCADE-REFERENCE.md.
- **Catches:** The maze drawn from y=0, overlapping the score display and clipping the bottom row of the board off-screen — including the tunnel row, so ghosts vanish where the player cannot see them.

### `an actor's centre maps to a sprite top-left offset by half the sprite, so a 16x16 actor is centred on its 8x8 tile`

**unit** · load-bearing

- **Why this type:** Unit: two numbers in, two out. This is the classic half-sprite off-by-eight, and catching it here names the file; catching it in the visual baseline says only 'the picture changed'.
- **Measures:** An actor whose centre is the centre of tile (14,23) produces a draw position of centre minus 8 in both axes, and an 8x8 pellet at the same tile is offset by 4.
- **Oracle:** The definition of centring plus the per-sprite dimensions established in slice s14 (actors 16x16, maze/pellet/glyph 8x8) — the sprite carries its own size, so the offset must be derived from it, not from a constant 8.
- **Catches:** Every actor drawn eight pixels down and right of where the rules say it is: collisions appear to happen a tile early, and players report that ghosts 'catch you through the wall'. The logic is right and only the picture lies, which makes it very hard to find.

### `wallSpriteName picks the straight, corner, tee and end pieces matching the four-neighbour bitmask`

**unit** · load-bearing

- **Why this type:** Unit, driven by hand-drawn 3x3 fixtures rather than the real 28x31 board, so the test SHOWS its own situation — the reader sees the neighbourhood that produces each piece. Reading tiles out of ARCADE_MAZE would make the expected value unverifiable without counting rows.
- **Measures:** For each of the sixteen neighbour masks (or the documented subset the art supports), the sprite name returned for the centre wall tile.
- **Oracle:** The stated tiling rule in slice s15: the piece is a function of which of the four orthogonal neighbours are also walls. Sixteen masks, sixteen named pieces — enumerable independently of the implementation.
- **Catches:** Corners drawn as straights, so the maze renders as a grid of disconnected dashes instead of continuous blue walls. Nothing in the rules changes; the board is simply illegible.

### `Pac-Man's mouth frame is derived from state.frame and cycles on the documented period`

**unit** · load-bearing

- **Why this type:** Unit over a pure naming function called with several frame numbers. Deriving animation from state.frame rather than a renderer-local counter is the architectural claim; a unit test calling the function twice with the same frame and getting the same name is what proves it.
- **Measures:** The sprite name across a run of consecutive frame numbers: the documented cycle of mouth frames, repeating, and identical for identical frame values (no hidden mutable counter).
- **Oracle:** Arcade animation timing for Pac-Man's mouth, with its frame period recorded in docs/ARCADE-REFERENCE.md; plus the stated invariant that the renderer is a pure projection of state.
- **Catches:** A module-level counter in the renderer: the animation speed then depends on how often the page repaints, and — worse — buildScene stops being pure, so a replay renders differently on the second run and the visual baseline flakes.

### `a blocked Pac-Man's mouth stops animating`

**unit** · guard

- **Why this type:** Unit, and deliberately paired with the test above: together they pin BOTH halves (animates normally, freezes when blocked). Alone it is weak, which the loadBearing flag admits — a naive implementation returning one constant name passes it and fails its partner.
- **Measures:** With blocked = true, the same sprite name is returned across several different state.frame values.
- **Oracle:** Arcade behaviour: Pac-Man's mouth holds mid-chew when he is pressed against a wall; docs/ARCADE-REFERENCE.md. Note the rule reads `blocked` off MoveResult rather than inventing a renderer-side idea of 'not moving'.
- **Catches:** Pac-Man chomping the air forever while jammed into a corner — visually wrong, and a sign the renderer has invented its own notion of movement instead of reading the one the rules already computed.

### `a ghost's eyes follow the direction it is facing`

**unit** · load-bearing

- **Why this type:** Unit: four facings, four names, one function. A component test through actors-scene would assert the same four strings with a scene builder in the way.
- **Measures:** For each Direction, the sprite name for a hunting ghost contains that facing, and the body colour matches the GhostId.
- **Oracle:** Arcade behaviour: a ghost's pupils always point the way it is travelling — the player's only cue for which way a ghost will turn.
- **Catches:** All four ghosts staring right forever. The game is still playable but the player loses the read on ghost intent, and a swapped ghost/facing lookup (blinky facing up drawing pinky's body) hides here too.

### `the frightened ghost starts flashing white at the documented frames-left and alternates on the documented period`

**unit** · load-bearing

- **Why this type:** Flash timing is a rule, so it is asserted rather than eyeballed. Unit over frightenedFramesLeft: assert one frame before the flash starts, the first flashing frame, and alternation across the period. A visual test can only show a blue ghost or a white one at one instant.
- **Measures:** The blue/white sprite name as a function of frightenedFramesLeft, and that the number of white flashes matches the level's frightenedFlashes.
- **Oracle:** Arcade behaviour: the ghosts blink white for the final stretch of fright, with the number of flashes taken from the per-level table; thresholds and period in docs/ARCADE-REFERENCE.md.
- **Catches:** No warning flash at all, or a flash that starts at the wrong moment. This is the player's entire signal for 'stop chasing, fright is about to end' — getting it wrong makes the game feel unfair rather than looking wrong.

### `a ghost in the Eyes phase draws only its eyes, even while the fright timer is still running`

**unit** · load-bearing

- **Why this type:** Unit: it is a precedence question between two independent fields (phase and frightenedFramesLeft), and a unit test can set exactly the contradictory combination that a real game reaches only briefly.
- **Measures:** With phase = Eyes and frightenedFramesLeft > 0, the name is the eyes sprite, not the frightened body.
- **Oracle:** Arcade behaviour: an eaten ghost is a pair of eyes until it reaches the house, regardless of the fright timer still counting down; and the design note in src/core/ghost/ghost.ts that fright is an orthogonal timer rather than a phase.
- **Catches:** An eaten ghost drawn as a blue edible ghost while it retreats — the player chases something that will kill them on contact, because collision.ts correctly passes it through while the picture says otherwise.

### `maze-scene draws the remaining pellets and omits the ones that have been eaten`

**component** · load-bearing

- **Why this type:** Component against the scene-sprite array (the same recording idea as render-scene.test.ts, one level up). It asserts both halves — the eaten tile is absent AND its neighbours are present — which is what stops an empty array from passing.
- **Measures:** For a PelletField with one specific tile eaten, the emitted pellet sprites cover exactly the remaining tiles, at the layout positions for those tiles.
- **Oracle:** The PelletField contract from slice s07 (eatAt removes a tile) plus the stated invariant that the scene is a pure projection of state — what the rules say is gone must not be on screen.
- **Catches:** Pellets that stay visible after being eaten and scored. The score climbs, the level completes, and the board still looks full — the single most confusing possible rendering bug.

### `actors-scene draws the fruit, then Pac-Man, then the ghosts in GHOST_ORDER, so ghosts overlap Pac-Man`

**component** · load-bearing

- **Why this type:** Component: the assertion is about the ORDER of the emitted sprite array, which the recording/array form makes readable as a list of names. A visual test would show the wrong overlap only in the one frame where two sprites happen to coincide.
- **Measures:** The index order of the emitted sprite names for a state where the fruit, Pac-Man and all four ghosts share nearby tiles.
- **Oracle:** Arcade behaviour: ghosts are drawn over Pac-Man; the bonus fruit sits under both. Draw order equals GHOST_ORDER, which src/core/ghost/ghost-id.ts documents as the one order used for release, collision, RNG and drawing.
- **Catches:** Pac-Man drawn on top of the ghost that just caught him, so the death frame reads as 'nothing happened'. It also catches a renderer that iterates Object.values(ghosts) and inherits key order instead of the pinned GHOST_ORDER.

### `during the dying phase the death animation replaces the ghosts entirely`

**component** · load-bearing

- **Why this type:** Component on the emitted array, because the assertion is an absence (no ghost sprites at all) alongside a presence (the death spin frame). Absence assertions need the full list, which is exactly what a scene builder returns.
- **Measures:** With phase = dying, the sprite list contains a death-spin frame chosen from phaseFramesLeft and contains no ghost sprite of any kind.
- **Oracle:** Arcade behaviour: on death the ghosts disappear and Pac-Man performs his spin alone; docs/ARCADE-REFERENCE.md.
- **Catches:** Four ghosts standing frozen around Pac-Man for the whole death animation — the classic 'I forgot the phase branch' bug, which is invisible to every rules test because the rules are correctly frozen too.

### `drawText throws on a character with no glyph rather than silently skipping it`

**unit** · load-bearing

- **Why this type:** Unit: one call, one expected throw. This is a loud-failure test in the same family as canvas-surface's unknown-sprite test that already exists in this repo, and it belongs at the level where the decision is made.
- **Measures:** That drawText with an unsupported character raises an error naming the character, and that a fully supported string emits one glyph sprite per 8 pixels of advance.
- **Oracle:** The stated design rule in slice s15: the sprite font is the only text mechanism, so an unmappable character is a bug in the caller and must be reported, not swallowed. Consistent with createCanvasSurface's existing behaviour for unknown sprite names.
- **Catches:** 'HIGH SCORE' rendering as 'HIGHSCORE' or 'GAME OVER!' losing its punctuation — a silent hole in the HUD that reads as a font bug and is actually a missing glyph nobody was told about.

### `hud-scene shows READY! in the ready phase, GAME OVER at game over, and neither while playing`

**component** · load-bearing

- **Why this type:** Component over the emitted sprite array, decoded back to text by glyph name. Three states in one test because the interesting content is the mutual exclusion. Doing it e2e would require reaching those phases through real play.
- **Measures:** The glyph sprites emitted for each of the three phases, plus the score, high score and one life icon per remaining life.
- **Oracle:** Arcade behaviour: READY! appears in the centre gap before each round and GAME OVER replaces it when the last life is lost; the lives row shows lives-in-reserve (one fewer icon than the lives count). docs/ARCADE-REFERENCE.md.
- **Catches:** READY! burned into the screen for the whole game, or a lives row that shows three icons when the player is on their last life — an off-by-one that makes the player think they have a spare life they do not have.

### `buildScene emits its layers in z-order: maze, pellets, fruit, actors, HUD`

**component** · load-bearing

- **Why this type:** Component: buildScene is the whole render boundary, and the only thing it adds over its parts is composition and order. Asserting the layer boundaries by first-index-of each sprite family keeps the test readable as the layer list itself.
- **Measures:** That the first wall sprite precedes the first pellet, which precedes the fruit, which precedes Pac-Man and the ghosts, which precede the HUD glyphs — in one Scene built from one state.
- **Oracle:** renderScene's already-tested and documented promise that sprites are drawn in array order, combined with the arcade's layering (walls behind everything, HUD in front). The array IS the z-order, stated in slice s15.
- **Catches:** The maze drawn last, covering every actor — a black screen with a blue maze and no game in it. Each layer's own unit tests all pass; only composition is wrong.

### `every sprite name buildScene can emit exists in the built atlas manifest`

**integration** · guard

- **Why this type:** Integration, because it is the only test that crosses render -> assets: it takes the names the renderer produces and looks them up in the manifest the atlas build wrote. Neither layer's unit tests can catch this — the renderer's tests assert names it also chose, and the atlas tests assert names it also chose. Needs expect.assertions(n) so an empty name set cannot pass by checking nothing.
- **Measures:** The union of names emitted by buildScene across a spread of states (each phase, each ghost phase, frightened and flashing, dying, every fruit, the full glyph set) is a subset of Object.keys(manifest.frames).
- **Oracle:** The atlas manifest generated by scripts/build-atlas.ts from the authored sprite sources — an artifact outside the renderer, which is what makes it a real oracle rather than a mirror.
- **Catches:** A typo'd sprite name — 'ghost-frighted-white' — that no type system sees. createCanvasSurface throws on an unknown name, so the game crashes the first time a ghost's fright timer reaches the flash threshold: minutes into play, in a state no unit test visits.

### `the first playable frame matches the committed visual baseline`

**visual** · load-bearing

- **Why this type:** Visual regression, because pixel art has failure modes that pass every assertion: a one-pixel sprite offset, a palette entry a shade off, a wall piece rotated. Nothing cheaper observes actual pixels. Kept to a single baseline because visual tests are slow and brittle, and because they detect CHANGE, not wrongness — the baseline itself is signed off by a human looking at it.
- **Measures:** A screenshot of the 224x288 canvas on the READY frame, diffed against a committed PNG.
- **Oracle:** A human-verified reference image, checked against photographs/documentation of the original cabinet during the visual-QA phase described in the TDD charter. The baseline is the oracle only because a person validated it first.
- **Catches:** The maze rendering with the right sprite names at the right coordinates but visibly wrong — walls one pixel out of alignment so the corridors look ragged, or the atlas repacked such that every frame is shifted by one pixel.

### `key-bindings maps the arrow keys and WASD to directions and Enter and Space to start`

**unit** · load-bearing

- **Why this type:** A pure lookup table, tested with no DOM at all — that is the whole reason it is a separate file from keyboard-input. A jsdom test would prove the same table more slowly and would confuse 'the table is right' with 'the listener works'.
- **Measures:** KeyboardEvent.code strings ('ArrowUp', 'KeyW', 'Enter', 'Space', ...) mapped to Direction values and the start action.
- **Oracle:** The project's stated control scheme (slice s16): arrows and WASD both steer; Enter or Space starts. A design decision, written down, not read off the implementation.
- **Catches:** Up and down swapped — trivially fixable, but note that screen coordinates put 'up' at negative y, so a mapping that looks right can be inverted. Also catches binding `event.key` instead of `event.code`, which silently breaks on non-QWERTY layouts.

### `key-bindings returns nothing for a code it does not know`

**unit** · guard

- **Why this type:** Unit. A guard against a defaulting table (returning Direction.Up for anything unmatched) — the cheapest possible place to state it.
- **Measures:** Lookup of unbound codes ('KeyQ', 'F5', '') yields undefined rather than a Direction or an action.
- **Oracle:** The stated contract: only listed codes are game actions. Everything else belongs to the browser.
- **Catches:** Pressing F5 or Cmd+Tab steering Pac-Man, or — the nastier version — a table whose default arm swallows every key so refresh and devtools shortcuts stop working while the game has focus.

### `keyboard input latches the most recently pressed direction while both keys are held`

**component** · load-bearing

- **Why this type:** Component in jsdom: it needs real KeyboardEvents dispatched at a real EventTarget, because the behaviour under test IS the listener's state machine. A pure unit test would have to fake the event plumbing that is the subject. An e2e test would prove it too, at a thousand times the cost and with flake.
- **Measures:** keydown Left, then keydown Up with Left still held, then read(): direction is Up. Release Up with Left still held: the snapshot is a stated, asserted outcome rather than an accident.
- **Oracle:** Arcade joystick semantics, restated as the design rule in slice s16: latest key wins. A four-way stick reports one direction; the most recent input is the player's intent.
- **Catches:** First-key-wins: at a corner the player presses the new direction slightly before releasing the old one, the turn is dropped, and the game feels unresponsive in exactly the moment that matters. This is the single most common cause of 'the controls feel bad'.

### `startPressed is true only on the frame the key went down`

**component** · load-bearing

- **Why this type:** Component in jsdom for the same reason: edge detection is a property of the listener plus the read() boundary. It is also the one place a repeat-key autorepeat can be simulated honestly.
- **Measures:** After a single keydown of Enter: the first read() reports startPressed true, the second reports false with no further events; a held key that fires OS autorepeat does not re-arm it.
- **Oracle:** The GameInput contract in src/core/game/game-input.ts: 'edge-triggered: true only on the frame the key went down'. A written invariant the input-system depends on.
- **Catches:** A held Enter key restarting the round sixty times a second, or skipping straight through the READY phase — and, because input-system consumes the start press, a level that never becomes playable.

### `dispose detaches the listeners: the snapshot changes before dispose and not after`

**component** · load-bearing

- **Why this type:** Component in jsdom, and written as a before/after pair so it cannot pass vacuously — a stub that never listened would fail the 'before' half. Leak tests that only assert 'nothing happened' are the classic false-green.
- **Measures:** A keydown before dispose changes read(); an identical keydown after dispose does not.
- **Oracle:** The InputSource contract in slice s16: dispose actually removes the listeners. A stated resource-ownership invariant.
- **Catches:** Listener leaks across restarts: after three games, one keypress is handled by three live input sources, and the ghosts consume the RNG stream out of step because inputs arrive duplicated. It presents as non-deterministic replay, which is the hardest possible bug to trace back to a forgotten removeEventListener.

### `the animation loop delivers ten frames with the deltas the injected clock reports`

**component** · load-bearing

- **Why this type:** Component with an injected scheduler and clock — no requestAnimationFrame, no waiting, no flake. This is why both dependencies are parameters. Doing it against a real rAF would take 167ms, be non-deterministic, and could not assert exact deltas at all.
- **Measures:** Driving the fake scheduler ten times with a clock advancing by known amounts yields ten onFrame calls whose deltaMs values equal the clock differences, and whose first delta is not the absolute timestamp.
- **Oracle:** The stated loop contract: onFrame receives the elapsed time since the previous frame. Elementary arithmetic on the injected clock, computed independently in the test.
- **Catches:** Passing rAF's absolute timestamp as the delta: the very first tick then advances the game by tens of thousands of frames — clamped by MAX_FRAMES_PER_STEP, so it presents as 'the game jumps forward on load' rather than as a crash.

### `stop halts the loop: frames arrive before it and none after`

**component** · load-bearing

- **Why this type:** Component with the fake scheduler, phrased as a before/after pair for the same anti-vacuity reason as the dispose test. A loop that never ran would otherwise pass 'no frames after stop'.
- **Measures:** Two frames delivered, then stop(), then pumping the scheduler several more times delivers nothing further.
- **Oracle:** The stated lifecycle contract of createAnimationLoop: stop means stop.
- **Catches:** A loop that keeps running after the page navigates away or after a restart, so two loops tick the same game and it runs at double speed — the bug that looks like a performance problem and is a lifecycle problem.

### `stopping from inside the frame callback does not schedule another frame`

**component** · guard

- **Why this type:** Component: re-entrancy is only expressible by calling stop() from within onFrame, which needs the scheduler seam. It is a guard, but a cheap one, and it documents an ordering hazard (schedule-then-call vs call-then-schedule) that is otherwise invisible.
- **Measures:** After a callback that calls stop() on its own frame, the fake scheduler has no pending callback registered.
- **Oracle:** The stated contract that stop is immediate, applied to the re-entrant case: 'no frame after stop' must hold even when stop is called during a frame.
- **Catches:** One extra frame running after game-over or after teardown — usually harmless, occasionally a ticking of a state that has already been disposed, producing an exception in the console on every restart.

### `one app frame reads the input once, ticks once and draws once`

**component** · load-bearing

- **Why this type:** Component with a recording DrawSurface, a scripted InputSource and a recording AudioOutput — no browser. game-app is pure wiring, and the only bug it can have is doing something the wrong number of times or in the wrong order, which call counts express directly. An e2e test would confirm the game works but could never assert 'exactly once'.
- **Measures:** Counts and order: InputSource.read called once, tick called once with that input and the frame's deltaMs, renderScene reaching the surface with exactly one clear.
- **Oracle:** The stated frame contract in slice s16. 'Exactly once' matters because tick is a reducer over an RNG stream: reading input twice or ticking twice per frame changes the game, not just the performance.
- **Catches:** Double-ticking (rendering inside the tick path as well as after it), which runs the game at 120fps on a 60Hz screen and desynchronises every replay from its recorded inputs.

### `the app applies exactly the AudioCommands decideAudio returned and threads the audio state between frames`

**component** · load-bearing

- **Why this type:** Component with a recording AudioOutput. The whole audio design rests on the app being a dumb executor — no decisions here — and the only way to demonstrate 'dumb' is to compare the commands applied against the commands returned. A unit test of decideAudio cannot see the wiring; an e2e test cannot hear it.
- **Measures:** Frame 1's recorded AudioOutput calls equal decideAudio's command array element for element, in order; frame 2 with an unchanged world records nothing further, because the returned AudioState was carried forward.
- **Oracle:** The stated architecture in slice s13: the decision of what to play is pure core logic and platform only executes. The command array is therefore the specification of the app's behaviour.
- **Catches:** The app re-deriving audio from a fresh AudioState each frame, so every frame re-issues `play siren` — the sixty-restarts-a-second bug again, this time leaking in at the composition root even though decideAudio itself is correctly idempotent. That is precisely why it is asserted twice, at both levels.

### `pressing Right in a real browser moves Pac-Man, removes a pellet and puts the score at 10`

**e2e** · load-bearing

- **Why this type:** The one test that proves every layer is genuinely connected: real Vite build, real canvas, real atlas fetch, real keyboard events, real rAF. Every cheaper test in this plan uses a fake at one seam or another, so all of them can pass while the app is wired to nothing. Exactly one such test, because it is slow and the most flake-prone thing in the suite.
- **Measures:** After page load and a held ArrowRight for a bounded number of frames: the canvas pixels at the first pellet's tile are background, Pac-Man's pixels have advanced, and the score region reads 10 — observed by reading canvas pixels (the HUD is sprite-font on canvas, so there is no DOM text to query) or via a documented debug hook on window that main.ts exposes for tests.
- **Oracle:** Arcade behaviour: a plain pellet is worth 10 points and is removed when eaten; docs/ARCADE-REFERENCE.md. The starting board and Pac-Man's spawn are fixed, so the first pellet's tile is known in advance.
- **Catches:** Everything unit-tested and nothing connected: a keyboard input source that is created but never read, an atlas that 404s in the built output, a game loop that is never started. Each layer's suite stays green and the page shows a static maze that does not respond to any key.
