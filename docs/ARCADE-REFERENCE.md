# The arcade reference

**Every number this game asserts, and where it came from.**

This file exists because of the TDD charter's [Defence A](TDD-CHARTER.md#challenge-3-the-tests-are-badly-written):

> the expectation comes from outside the code.

A test that says `expect(levelSpec(1).frightenedFrames).toBe(360)` is only worth something if the
`360` came from somewhere other than the implementation. If it was copied out of the code, the test
is a tautology: it will pass forever and protect nothing. So every arcade constant in the test suite
cites a section of this file, and every section of this file cites a source outside this repository.

**How to read a citation.** A row marked _[Dossier A.1]_ is a fact about the original 1980 arcade
board, transcribed from the source named below. A row marked _[repo convention]_ is a decision **we**
made, because the original either does not specify it or specifies it in units we do not use. The
distinction is the whole point: a test may assert either, but the two are not the same kind of claim,
and a reader is entitled to know which one they are looking at.

---

## Sources

| Tag             | Source                                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[Dossier]**   | Jamey Pittman, _The Pac-Man Dossier_ — <https://pacman.holenet.info/>. The standard reference work, derived from the arcade ROM. Section names below are the document's own. |
| **[Dossier A]** | The same document, Appendix A, _Level Specifications_ (Table A.1). The per-level difficulty table.                                                                           |
| **[repo]**      | A decision recorded in [`ARCHITECTURE.md`](ARCHITECTURE.md) or here. Not an arcade fact.                                                                                     |

---

## 1. Time: how a second becomes a frame

The arcade board's video hardware refreshes at **60.606061 Hz** [Dossier], which the Dossier itself
also writes as "1/60th second per frame". Every duration in Table A.1 is quoted in **seconds**.

**[repo convention]** We run the simulation at exactly **60 frames per second**
(`FRAME_MS = 1000 / 60`, defined in `src/core/time/frame-clock.ts`), and convert:

```
frames = seconds × 60
```

So the level-1 fright of 6 seconds is **360 frames**, and the level-1 opening scatter of 7 seconds is
**420 frames**.

This is deliberately about **1% slower** than the real board (60 vs 60.606 Hz). We take that trade
knowingly: a whole-number frame rate keeps every duration an exact integer, which is what lets tests
assert `toBe(360)` instead of `toBeCloseTo`. Nothing in the game measures wall-clock time against
anything else, so the 1% is invisible in play.

> **Note for test authors.** Tests in `src/core/rules/` state durations as **frame literals** with
> the seconds shown in a comment (`420, // 7s`). They do not import `FRAME_MS` and multiply. That is
> not laziness: an expectation computed by the same arithmetic the implementation uses is no longer
> an independent oracle. `420` is checkable against this document by a human reading the test.

---

## 2. Speed: what "80%" means

**[Dossier]** _"100% speed = 75.75757625 pixels/sec"_.

That figure is the board's refresh rate times a whole number of quarter-pixels:

```
75.75757625 px/sec ÷ 60.606061 frames/sec = 1.25 pixels per frame at 100%
```

**[repo convention]** `src/core/actor/actor.ts` defines `SUBPIXELS_PER_PIXEL = 256`, so:

```
FULL_SPEED = 1.25 × 256 = 320 sub-pixels per frame at 100%
```

`src/core/actor/speed.ts` is the only place a percentage becomes sub-pixels
(`speedSubPixels(fraction) = Math.round(fraction × FULL_SPEED)`), and it is pinned by slice s03. The
per-level table below states speeds as **fractions of full speed** — `0.8`, not `80` and not `205` —
exactly as the arcade table states them, so the published table drops in with no conversion to get
wrong.

**[repo convention]** The original does not move an actor 1.25 pixels; it moves whole pixels on a
per-frame move/skip pattern that averages 1.25. We approximate that with an integer sub-pixel carry
(`carrySubPixels`, always in `[0, 256)`). Average speed matches exactly and everything stays
deterministic, but an individual frame can differ from the ROM by a pixel. This is one of the two
risks the architecture carries openly.

---

## 3. Per-level table

**[Dossier A]**, transcribed complete. Levels **21 and above all use the level-21 row**, so the table
has 21 rows and nothing beyond it.

Columns, in the order `LevelSpec` declares them:

| Lv  | Pac  | Pac·dot | Ghost | Ghost·tunnel | Elroy1 dots | Elroy1 | Elroy2 dots | Elroy2 | Pac·fright | Pac·fright·dot | Ghost·fright | Fright | Flashes | Fruit      | Points |
| --- | ---- | ------- | ----- | ------------ | ----------- | ------ | ----------- | ------ | ---------- | -------------- | ------------ | ------ | ------- | ---------- | ------ |
| 1   | 80%  | ~71%    | 75%   | 40%          | 20          | 80%    | 10          | 85%    | 90%        | ~79%           | 50%          | 6 s    | 5       | cherry     | 100    |
| 2   | 90%  | ~79%    | 85%   | 45%          | 30          | 90%    | 15          | 95%    | 95%        | ~83%           | 55%          | 5 s    | 5       | strawberry | 300    |
| 3   | 90%  | ~79%    | 85%   | 45%          | 40          | 90%    | 20          | 95%    | 95%        | ~83%           | 55%          | 4 s    | 5       | orange     | 500    |
| 4   | 90%  | ~79%    | 85%   | 45%          | 40          | 90%    | 20          | 95%    | 95%        | ~83%           | 55%          | 3 s    | 5       | orange     | 500    |
| 5   | 100% | ~87%    | 95%   | 50%          | 40          | 100%   | 20          | 105%   | 100%       | ~87%           | 60%          | 2 s    | 5       | apple      | 700    |
| 6   | 100% | ~87%    | 95%   | 50%          | 50          | 100%   | 25          | 105%   | 100%       | ~87%           | 60%          | 5 s    | 5       | apple      | 700    |
| 7   | 100% | ~87%    | 95%   | 50%          | 50          | 100%   | 25          | 105%   | 100%       | ~87%           | 60%          | 2 s    | 5       | melon      | 1000   |
| 8   | 100% | ~87%    | 95%   | 50%          | 50          | 100%   | 25          | 105%   | 100%       | ~87%           | 60%          | 2 s    | 5       | melon      | 1000   |
| 9   | 100% | ~87%    | 95%   | 50%          | 60          | 100%   | 30          | 105%   | 100%       | ~87%           | 60%          | 1 s    | 3       | galaxian   | 2000   |
| 10  | 100% | ~87%    | 95%   | 50%          | 60          | 100%   | 30          | 105%   | 100%       | ~87%           | 60%          | 5 s    | 5       | galaxian   | 2000   |
| 11  | 100% | ~87%    | 95%   | 50%          | 60          | 100%   | 30          | 105%   | 100%       | ~87%           | 60%          | 2 s    | 5       | bell       | 3000   |
| 12  | 100% | ~87%    | 95%   | 50%          | 80          | 100%   | 40          | 105%   | 100%       | ~87%           | 60%          | 1 s    | 3       | bell       | 3000   |
| 13  | 100% | ~87%    | 95%   | 50%          | 80          | 100%   | 40          | 105%   | 100%       | ~87%           | 60%          | 1 s    | 3       | key        | 5000   |
| 14  | 100% | ~87%    | 95%   | 50%          | 80          | 100%   | 40          | 105%   | 100%       | ~87%           | 60%          | 3 s    | 5       | key        | 5000   |
| 15  | 100% | ~87%    | 95%   | 50%          | 100         | 100%   | 50          | 105%   | 100%       | ~87%           | 60%          | 1 s    | 3       | key        | 5000   |
| 16  | 100% | ~87%    | 95%   | 50%          | 100         | 100%   | 50          | 105%   | 100%       | ~87%           | 60%          | 1 s    | 3       | key        | 5000   |
| 17  | 100% | ~87%    | 95%   | 50%          | 100         | 100%   | 50          | 105%   | —          | —              | —            | **0**  | **0**   | key        | 5000   |
| 18  | 100% | ~87%    | 95%   | 50%          | 100         | 100%   | 50          | 105%   | 100%       | ~87%           | 60%          | 1 s    | 3       | key        | 5000   |
| 19  | 100% | ~87%    | 95%   | 50%          | 120         | 100%   | 60          | 105%   | —          | —              | —            | **0**  | **0**   | key        | 5000   |
| 20  | 100% | ~87%    | 95%   | 50%          | 120         | 100%   | 60          | 105%   | —          | —              | —            | **0**  | **0**   | key        | 5000   |
| 21+ | 90%  | ~79%    | 95%   | 50%          | 120         | 100%   | 60          | 105%   | —          | —              | —            | **0**  | **0**   | key        | 5000   |

### Notes on the table

**The tilde.** [Dossier A] prints the "dots" speeds as `~71%`, `~79%`, `~83%`, `~87%`. The tilde is
the Dossier's own: Pac-Man's slowdown while eating is not a clean percentage in the ROM, and these
are the rounded figures the Dossier publishes. **[repo convention]** we use the printed two-digit
values exactly (`0.71`, `0.79`, `0.83`, `0.87`).

**The dashes.** Where the table prints `—` the level has **no fright at all**: fright lasts zero
frames, so no ghost ever turns blue, and the frightened speed columns are never read.
**[repo convention]** `LevelSpec` has no optional fields, so those rows carry the last values that
were actually used (`pacmanFrightSpeed 1.0`, `pacmanFrightDotSpeed 0.87`, `ghostFrightSpeed 0.6`).
**These three numbers on levels 17, 19, 20 and 21+ are a representation choice, not an arcade fact.**
They are unobservable in play, and a test asserting them is asserting this paragraph.

**Level 17 is not a typo.** Fright time drops to zero at level 17, comes _back_ for one second at
level 18, and is gone for good from level 19. The difficulty curve is genuinely non-monotonic there.
Our tests pin levels 18, 19 and 20 (the "zero from 19 on" boundary the game actually depends on) and
name 17 explicitly so a future reader does not "fix" it.

**Level 21 slows Pac-Man down.** From level 21 Pac-Man drops back to 90%/79% while the ghosts stay at
95%. He is slower than they are, forever. That is the original's final answer to a good player, and
it is why the level-21 row matters enough to have its own test.

**Fruit names.** [Dossier A] labels the third and fifth fruits _Peach_ and _Grapes_. The sprites are
conventionally read as an **orange** and a **melon**, which is the naming
[`ARCHITECTURE.md`](ARCHITECTURE.md) uses for the sprite roster, so `FruitKind` uses `orange` and
`melon`. Same eight objects, same points, different words for two of them.

**Frame conversions** of the fright column, by section 1: 6 s = **360**, 5 s = **300**, 4 s = **240**,
3 s = **180**, 2 s = **120**, 1 s = **60**, 0 = **0**.

---

## 4. Scatter and chase: the wave clock

**[Dossier]** The ghosts alternate between _scatter_ (head for a fixed home corner) and _chase_ (hunt
Pac-Man). The alternation is driven by one global timer, not by anything the player does. There are
**four scatter periods**; after the fourth, the ghosts remain in chase mode permanently.

### The three tables

Seconds are the Dossier's; frames are `seconds × 60` per section 1.

**Level 1**

| #   | Mode    | Seconds | Frames |
| --- | ------- | ------- | ------ |
| 0   | scatter | 7       | 420    |
| 1   | chase   | 20      | 1200   |
| 2   | scatter | 7       | 420    |
| 3   | chase   | 20      | 1200   |
| 4   | scatter | 5       | 300    |
| 5   | chase   | 20      | 1200   |
| 6   | scatter | 5       | 300    |
| 7   | chase   | forever | `null` |

**Levels 2 to 4**

| #   | Mode    | Seconds | Frames |
| --- | ------- | ------- | ------ |
| 0   | scatter | 7       | 420    |
| 1   | chase   | 20      | 1200   |
| 2   | scatter | 7       | 420    |
| 3   | chase   | 20      | 1200   |
| 4   | scatter | 5       | 300    |
| 5   | chase   | 1033    | 61980  |
| 6   | scatter | 1/60    | 1      |
| 7   | chase   | forever | `null` |

**Levels 5 and up**

| #   | Mode    | Seconds | Frames |
| --- | ------- | ------- | ------ |
| 0   | scatter | 5       | 300    |
| 1   | chase   | 20      | 1200   |
| 2   | scatter | 5       | 300    |
| 3   | chase   | 20      | 1200   |
| 4   | scatter | 5       | 300    |
| 5   | chase   | 1037    | 62220  |
| 6   | scatter | 1/60    | 1      |
| 7   | chase   | forever | `null` |

The **one-frame scatter** at index 6 is real. From level 2 onward the fourth scatter period lasts a
single frame — long enough to force the reversal below and nothing more. It is the sort of detail
that looks like a bug in a diff, so it gets a named test.

**[repo convention]** "Forever" is represented as `durationFrames: null`, not as a huge number and
not by running off the end of the array. `null` is a value the type system makes you handle; an
absent eighth entry is an `undefined` that `noUncheckedIndexedAccess` will hand you at the worst
possible moment.

### Reversal

**[Dossier]** _"Ghosts are forced to reverse direction by the system anytime the mode changes from:
chase-to-scatter, chase-to-frightened, scatter-to-chase, and scatter-to-frightened."_

Two consequences, and they live in different modules:

- **scatter↔chase** — a wave boundary. `advanceModes` reports `reversalRequired: true` on **exactly
  the one frame** the wave index changes, and `false` on every other frame. It is an **edge**, not a
  level: a ghost that reversed on every frame of the new mode would vibrate on the spot.
- **→frightened** — eating a power pellet. That reversal is raised where the pellet is eaten, not by
  the wave clock, so `advanceModes` never reports it.

Fright **ending** is not in the Dossier's list, so it does **not** reverse anybody.

### Fright pauses the clock

**[Dossier]** _"If the ghosts enter frightened mode, the scatter/chase timer is paused. When time
runs out, they return to the mode they were in before being frightened and the scatter/chase timer
resumes."_

This one sentence is the whole reason `advanceModes` takes the fright timer as an input instead of
letting something else own it. Get it wrong and every power pellet silently eats several seconds of
the player's scatter time, so the late waves arrive early — a drift no single-frame test can see.

**[repo convention]**, three tie-breaks the Dossier does not state, pinned by
`mode-schedule.test.ts` so that GREEN has no room to guess:

1. The wave clock advances on a frame **iff** `frightenedFramesLeft === 0` at the **start** of that
   frame. The frame on which the timer falls from 1 to 0 is therefore still a frozen frame; the clock
   resumes on the frame after it.
2. `frightenedEnded` is an **edge**: true on the single frame the timer reaches zero, false on every
   frame thereafter. Downstream (the siren, the ghost-score ladder, the speed row) all depend on
   hearing it once.
3. A wave flips when the frames spent in it **reach** its duration: a 420-frame wave is flipped by
   the 420th advance, and the new wave's frame count starts at 0.

---

## 5. Cruise Elroy

**[Dossier]** Blinky speeds up twice per level as the board empties. The two thresholds are the
`Elroy1 dots` and `Elroy2 dots` columns of the table above, counted in **dots remaining**, and each
stage has its own speed — at level 1, stage 1 at 20 dots left (80%, i.e. faster than the other
ghosts' 75%) and stage 2 at 10 dots left (85%).

**[Dossier]** Elroy is **suspended while any ghost is still inside the house**, and resumes when the
house is empty. Blinky reverts to the ordinary ghost speed while suspended.

The threshold numbers live in `LevelSpec` (`elroy1DotsLeft`, `elroy1Speed`, `elroy2DotsLeft`,
`elroy2Speed`) and are pinned by `level-table.test.ts`; the _rule_ that reads them belongs to
`src/core/ghost/elroy.ts` and is pinned by slice s06.

---

## 6. Ghost targeting

Each ghost picks a **target tile** every frame and then steps toward it. The four ghosts differ only
in how that tile is chosen — that single rule is the whole of Pac-Man's AI, and it is why the ghosts
feel like they have personalities.

### 6.1 Scatter corners

During a scatter wave every ghost targets a fixed corner. The ROM's targets, in the machine's
**28×36 screen space**: _[Dossier, "Scatter mode"]_

| Ghost  | ROM target (28×36) | Corner       |
| ------ | ------------------ | ------------ |
| Blinky | (25, 0)            | top right    |
| Pinky  | (2, 0)             | top left     |
| Inky   | (27, 35)           | bottom right |
| Clyde  | (0, 35)            | bottom left  |

**This codebase uses a 28×31 playfield, not the 28×36 screen.** The screen's rows 0–2 are the score
display and rows 34–35 are the lives and fruit strip; only rows 3–33 are maze. So the ROM's bottom
targets at row 35 have no playfield equivalent, and are remapped to the last playfield row:

| Ghost  | This codebase | Origin                              |
| ------ | ------------- | ----------------------------------- |
| Blinky | (25, 0)       | ROM value, unchanged _[Dossier]_    |
| Pinky  | (2, 0)        | ROM value, unchanged _[Dossier]_    |
| Inky   | (27, 30)      | row 35 → row 30 _[repo convention]_ |
| Clyde  | (0, 30)       | row 35 → row 30 _[repo convention]_ |

A reader checking (27, 30) against any external Pac-Man source **will find (27, 35) instead**. That is
expected, and this row is why. The behaviour is preserved: what matters is that the target sits in the
corner and outside the walkable maze, so the ghost orbits the corner block rather than ever arriving.

### 6.2 Blinky — direct chase

Targets Pac-Man's current tile, exactly. _[Dossier, "Blinky"]_

### 6.3 Pinky — four ahead, including the overflow bug

Targets **four tiles ahead** of Pac-Man's facing. _[Dossier, "Pinky"]_

When Pac-Man faces **up**, the arcade adds the offset to _both_ axes, giving four tiles up **and four
tiles left**:

| Pac-Man faces | Offset applied |
| ------------- | -------------- |
| right         | (+4, 0)        |
| down          | (0, +4)        |
| left          | (−4, 0)        |
| **up**        | **(−4, −4)**   |

This is a **bug in the original 1980 code** — an overflow in the routine that added the direction
vector. It is reproduced deliberately. Removing it would make Pinky play differently from the arcade,
so the test that pins it says so explicitly. _[Dossier, "Pinky", the up-vector bug]_

### 6.4 Inky — Blinky's vector, doubled

The most involved rule, and the reason Inky is unpredictable. _[Dossier, "Inky"]_

1. Take the tile **two ahead** of Pac-Man's facing — using the **same up-overflow** as Pinky, so
   facing up gives (−2, −2).
2. Draw the vector from **Blinky's** tile to that pivot.
3. **Double** it: the target is the pivot plus (pivot minus Blinky's tile).

Inky therefore depends on Blinky's position, which is why the two of them can pincer.

### 6.5 Clyde — eight tiles, then run away

Clyde chases Pac-Man while **farther than eight tiles**, and retreats to his own scatter corner while
nearer. _[Dossier, "Clyde"]_

The comparison is made on **squared** distance against **64** (8² = 64), because the arcade compares
squared distances rather than taking a square root.

**At exactly 64 the Dossier is silent.** Its prose says chase when "farther than eight tiles" and
retreat when "closer than eight". This codebase assigns the boundary to **retreat** — chase only when
the squared distance is strictly greater than 64. That matches the comparison used in the usual
reference implementations, but it is a reading, not a transcription. _[repo convention]_

The distance is measured over **both axes** (squared Euclidean): not along a single column, and not as
a city-block walk. A fixture placed on Pac-Man's own row cannot tell those three metrics apart, so the
suite includes a diagonal fixture that can.

### 6.6 Fright

A power pellet frightens **every** ghost, including ghosts still inside the house. _[Dossier,
"Frightened mode"]_

An **eaten** ghost — one reduced to eyes and heading home — is _not_ frightened in the arcade: it is
neither blue nor edible. This codebase's `isFrightened` predicate nonetheless returns true while the
fright timer runs, in every phase including Eyes, and the collision rule carries the exception.
_[repo convention]_ — recorded here so that a future reader does not "restore arcade accuracy" by
adding a phase check and find themselves contradicted by a passing test.

---

## 7. The round: how a game begins, and the pauses between play

Everything in this section is used by `src/core/game/` (slice s09). Read the tags carefully: this is
the section of the document with the **highest proportion of `[repo convention]`**, because the
Dossier is a document about ghost behaviour and simply does not tabulate the presentation timings.
Rather than dress a guess as a transcription, each number below states what fixes it.

### 7.1 Starting lives

**3.** The cabinet's DIP switches offer 1, 2, 3 or 5 lives per game; **3 is the factory setting**, and
it is what a player meets in an arcade. _[repo convention]_ — the number is a machine setting rather
than a property of the ROM's game logic, so this codebase fixes it at the factory default instead of
modelling the switch.

### 7.2 Round-phase durations

The game is not always playable. Between rounds, after a death and after the board is cleared, the
simulation freezes for a fixed number of frames while the presentation catches up. `RoundPhase`
carries one duration each, in frames (section 1: 60 frames = 1 s).

| Phase           | Frames | Seconds | Source                                                                                         |
| --------------- | ------ | ------- | ---------------------------------------------------------------------------------------------- |
| `ready`         | 120    | 2 s     | _[repo convention]_ — the arcade's "READY!" pause. See the note on the first round below.      |
| `playing`       | **0**  | —       | _[repo convention]_ — 0 means "no timer": the phase ends because of an event, not a countdown. |
| `dying`         | 180    | 3 s     | _[repo convention]_ — a ~1 s freeze on the moment of capture, then the ~2 s death spin.        |
| `levelComplete` | 120    | 2 s     | _[repo convention]_ — the maze flashes 4 times; at 15 frames per half-flash, 4 × 2 × 15 = 120. |
| `gameOver`      | **0**  | —       | _[repo convention]_ — the game is over; nothing counts down to anything.                       |

**Why they are deliberately three different numbers.** 120, 180 and 120 could all have been "two
seconds" and nobody would notice in play. They are distinct so that an implementation which reads the
_wrong row_ of the table — the classic copy-paste bug in a lookup like this — produces a failing
assertion rather than a game that looks fine. A table whose rows are all equal cannot be tested.

**The first round is longer in the arcade** (the ~4 s opening tune plays before the first "READY!"
clears, against ~2 s on later rounds). This codebase uses **one** duration for every round.
_[repo convention]_ — the intro tune is an audio cue (slice s13), not a rule, and a
first-round-only branch in the phase timer would be a special case with no test that could tell it
from a bug.

### 7.3 Where everything stands when a round starts

| Thing              | Value                                                                               | Source                                       |
| ------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| Pac-Man's tile     | `Maze.pacmanSpawn` — (13, 23) on the classic board                                  | _[Dossier]_, pinned by `arcade-maze.test.ts` |
| Ghost tiles        | `Maze.ghostSpawns` — Blinky (13, 11), Pinky (13, 14), Inky (11, 14), Clyde (15, 14) | _[Dossier]_, same test                       |
| Every actor's spot | the **centre pixel** of its spawn tile, with a zero sub-pixel carry                 | _[repo convention]_, section 2               |
| Pac-Man's facing   | **left**                                                                            | _[repo convention]_ (see below)              |
| Blinky's facing    | **left**                                                                            | _[repo convention]_                          |
| Pinky's facing     | **down**                                                                            | _[repo convention]_                          |
| Inky's facing      | **up**                                                                              | _[repo convention]_                          |
| Clyde's facing     | **up**                                                                              | _[repo convention]_                          |
| Dots on the board  | 240 plain, 4 energizers (section — see s02's board facts)                           | _[Dossier]_                                  |
| Wave clock         | wave 0, zero frames spent, no fright running                                        | follows from section 4                       |

**The facings are the weakest claim on this page, and they are tagged accordingly.** They are read
from the original's round-start screen — Blinky sits above the house facing left, the three inside
bob on the axis they are drawn on — and the Dossier tabulates none of them. They are pinned by a test
anyway, because "unspecified" would mean the renderer picks a different sprite on different runs,
which is worse than a documented guess. If someone with a ROM disassembly corrects a row here, the
test that fails is the one that should fail.

---

## 8. Pac-Man: the dot census, the eating freeze, the spawn and the queued turn

Added by slice **s07**. Section 7's table previously deferred the dot census to s02, but
`classic-layout.test.ts` already cites this document for it, so the numbers are written down here
rather than left dangling.

### 8.1 The dot census: 240 + 4 = 244

**[Dossier]** Every level of the original is the same board and carries the same food: **240 plain
dots** and **4 energizers**, for **244** edible tiles in total. A level ends when all 244 are gone —
not when the dots alone are gone, which is why `isCleared` has to consult both sets.

The 244 also drive two other rules that live elsewhere: fruit appears at **70** and **170** dots
_eaten_ (slice s08), and Cruise Elroy engages at a threshold counted in dots _remaining_ (section 5).

### 8.2 The eating freeze: 1 frame for a dot, 3 for an energizer

**[Dossier, "Speed"]**, quoted verbatim:

> "Every time Pac-Man eats a regular dot, he stops moving for one frame (1/60th of a second), slowing
> his progress by roughly ten percent—just enough for a following ghost to overtake him. Eating an
> energizer dot causes Pac-Man to stop moving for three frames."

| Eaten     | Frames Pac-Man does not move |
| --------- | ---------------------------- |
| dot       | **1**                        |
| energizer | **3**                        |

This is not a cosmetic detail, and the Dossier's own clause says why: _"just enough for a following
ghost to overtake him."_ Pac-Man's level-1 speed is 80% against the ghosts' 75% (section 3), so
without the freeze he would be permanently faster than everything chasing him and a competent player
could simply run laps. The freeze is the entire reason a full board is dangerous.

**[repo convention]** The freeze is expressed as a `stopFrames` count on `Pacman`, produced by
`eat()` and consumed by `pacman-system` (slice s10), which skips the move and decrements. `eat()`
reports the number; it does not apply it, and it does not score — the 10 and the 50 belong to
`rules/points.ts` in slice s08.

**[repo convention]** The two counts do not accumulate: eating an energizer while a dot's single
frame is still pending sets the counter to 3 rather than to 4. On the real board Pac-Man cannot
occupy a dot tile and an energizer tile on consecutive frames at any speed in section 3, so the case
is unreachable in play and the simpler rule is chosen deliberately.

### 8.3 Where Pac-Man starts, and which way he faces

**[Dossier]** Pac-Man begins each life on the board's lower central corridor, which the ASCII layout
in `classic-layout.ts` marks with `P`.

**[repo convention]** He spawns **facing left**, stationary, with nothing queued: `carrySubPixels` 0,
`pendingDirection` null, `stopFrames` 0, `animationFrame` 0. The Dossier does not state an initial
facing anywhere — this was checked, not assumed — so **left** is corroborated only by the original's
start-of-life sprite and by the fact that the first dots a player takes are to the left. It is our
decision, and a test asserting it is asserting this paragraph.

**[repo convention]** The arcade starts Pac-Man on a tile _boundary_ rather than a tile centre. This
codebase spawns him on the centre pixel of the `P` tile, because every turn decision in
`move-actor.ts` is taken on a tile centre and a spawn that is half a tile off would make the first
turn of every life behave differently from every later one.

### 8.4 The queued turn, and how far it is from the arcade

**[Dossier, "Cornering"]** The original reads the joystick every frame into a "desired direction" and
applies it the moment the maze allows. A perpendicular turn may be entered _before_ the corner: the
Dossier measures **three pre-turn pixels** before the centre of a turn entered from the left and
**four** from the right, and adds that _"for any turn that is made later than the earliest possible
pre-turn, Pac-Man will be one frame behind where he would be for every pixel of 'lateness' in the
turn."_ Turning early is therefore genuinely faster than turning late, which is what expert play
exploits.

**[repo convention]**, and this is the honest gap: we do **not** model the 3/4-pixel pre-turn window
or its frame bonus. A queued direction is retried **every pixel** and applied at the first tile
centre where it is legal, and it **persists indefinitely** until it is taken or overwritten — it
never expires. Compared with the ROM this is slightly _more_ forgiving (a direction pressed a whole
corridor early is still honoured) and slightly slower through a corner (no early cut). The trade is
taken so that cornering does not demand frame-perfect input, and it is recorded here so that a reader
comparing this game with the arcade knows where the difference is.

**[Dossier]** A **reversal** — the opposite of the current facing — is applied **immediately**, at
whatever pixel Pac-Man occupies, without waiting for a tile centre. He is already in a corridor that
runs that way, so there is nothing to wait for. This is the one rule that makes evasion feel
responsive, and it is the opposite of the ghost rule: ghosts may _never_ reverse of their own accord
(section 4, "Reversal").

---

## 9. The turn decision

Added by slice **s06**. Section 6 says where a ghost _wants_ to go; this section says how it gets
there — and it is the whole of ghost movement, because a ghost has no path-finder. It has one rule,
applied one tile at a time.

**[Dossier, "Ghost movement"]** A ghost travels in a straight line until it reaches a tile with more
than one exit. There it considers each exit, looks at the tile that exit leads to, and takes the exit
whose tile is **nearest its target in straight-line distance**. The comparison is on **squared**
distance (section 6.5), because the arcade never takes a square root.

Three qualifiers, all of them arcade facts:

1. **No reversal.** _[Dossier]_ — _"Ghosts are never allowed to reverse direction"_ while navigating.
   The only reversals in the game are the ones the system forces on a mode change (section 4).
2. **The tie order is up, left, down, right.** _[Dossier]_ The ROM evaluates the candidate directions
   in that fixed sequence and keeps a candidate only when it is **strictly** nearer than the best so
   far, so when two exits are exactly equidistant the **earlier** one wins — and `right` can never win
   a tie at all. `ALL_DIRECTIONS` in `src/core/geometry/direction.ts` is that sequence, and
   `walkableNeighbours` already returns exits in it.
3. **The four no-up tiles.** _[Dossier, "The ghost house"]_ On four tiles of the board a ghost may not
   choose to turn upward — a quirk of the original code, not of the walls. The tiles are
   `maze.noUpTiles`, authored in slice s02; the RULE that a ghost never chooses `up` out of one of
   them lives in `src/core/ghost/choose-direction.ts`.

### 9.1 The dead end

**[repo convention]** The no-reversal rule is a **preference applied to the candidate list**, not an
absolute prohibition. When removing the reversal would leave no candidate at all — a dead-end pocket,
of which the real board has several around the ghost house — the reversal is taken. The Dossier does
not state this case because the arcade computes its turn one tile in advance and never asks the
question; a function that threw here would crash mid-frame in front of a player.

### 9.2 Where the decision is made

**[repo convention]** The original computes the turn for the tile it is _about to enter_, one tile
ahead of the ghost. This codebase makes the same decision **at the tile centre**, from the tile the
ghost is standing on. The path chosen is identical — the same rule over the same graph — and keeping
the decision at the centre is what lets `chooseDirection` stay a pure function of
`(maze, tile, facing, target)` with no lookahead state to get wrong.

---

## 10. Frightened turns

Added by slice **s06**.

**[Dossier, "Frightened mode"]** A frightened ghost stops targeting. At each tile it generates a
**pseudo-random** direction; if that direction is not legal — a wall, or a reversal — it then tries
up, left, down and right in order and takes the first legal one.

**[repo convention]** We do not reproduce the ROM's random generator. Its output is an artefact of the
hardware rather than an observable rule, and reproducing it would pin our tests to a bit pattern no
reader could check. Instead:

- `chooseFrightenedDirection(rng, legal)` receives the **already legal** exits, in `ALL_DIRECTIONS`
  order (exactly what `walkableNeighbours` returns), and draws `rng.nextInt(legal.length)` as an index
  into that list. Filtering before drawing, rather than drawing then retrying, is what makes the next
  rule statable at all.
- **Exactly one draw per decision.** Not one per frame, and not one per rejected candidate. This is a
  contract of `src/core/game/replay.ts` rather than of the arcade: the seeded `Rng` stream must be
  consumed identically on every replay of the same input log, so the NUMBER of draws is as
  load-bearing as their values. `createScriptedRng` throws when its script runs out, which turns
  "exactly one" into an assertion instead of a hope.

Everything a player can observe is preserved: the turn is uniform over the legal exits, and the legal
exits differ from tile to tile.

---

## 11. Ghost speed selection

Added by slice **s06**. Section 3 supplies the per-level numbers; this section says which of them
applies when. Every answer is a fraction handed to `speedSubPixels` (section 2), so a level-1 ghost at
75% moves `0.75 × 320 = 240` sub-pixels per frame.

| Situation                | Fraction                                | Level 1 sub-pixels | Source              |
| ------------------------ | --------------------------------------- | ------------------ | ------------------- |
| Eyes, returning home     | `1.5`                                   | 480                | _[repo convention]_ |
| In the tunnel            | `spec.ghostTunnelSpeed`                 | 128 (40%)          | _[Dossier A]_       |
| Frightened               | `spec.ghostFrightSpeed`                 | 160 (50%)          | _[Dossier A]_       |
| Blinky, Cruise Elroy 1/2 | `spec.elroy1Speed` / `spec.elroy2Speed` | 256 / 272 (80/85%) | _[Dossier A]_       |
| Anything else            | `spec.ghostSpeed`                       | 240 (75%)          | _[Dossier A]_       |

### 11.1 The precedence, which is where the bugs are

**[repo convention]** The table is read **top to bottom**, and that order is a decision:

- **Eyes beat everything, including the tunnel.** _[Dossier]_ says an eaten ghost returns to the house
  quickly; it does not say whether it crawls through the tunnel on the way. We say it does not,
  because the point of the eyes is to put the ghost back in play, and a pair of eyes stuck at 40% in
  the tunnel would remove a ghost from an entire fright period.
- **The tunnel beats fright.** A frightened ghost in the tunnel crawls at the tunnel speed, not at the
  frightened speed. The tunnel carries the slowest number in the table, and the tunnel mouths are
  where a player corners a blue ghost; the wrong way round makes a frightened ghost in the tunnel
  measurably faster than the arcade's.
- **Fright beats Cruise Elroy.** A frightened Blinky is a frightened ghost first: blue, edible and
  slow. Elroy is a chase behaviour and does not apply while he is running away.

### 11.2 The eyes speed

**[repo convention].** Table A.1 has no column for it — the Dossier does not publish an eyes speed —
so `1.5` (150%) is **our** number. It is chosen so that eyes are strictly faster than every living
actor at every level: the fastest fraction anywhere else in the table is Cruise Elroy 2 at `1.05`
(336 sub-pixels), and Pac-Man never exceeds `1.0`. A test asserting 480 is asserting this paragraph
and not the ROM.

---

## 12. The ghost house

Added by slice **s06**. Blinky starts on the board. The other three start inside the house and are let
out one at a time by **three independent rules**, any of which can fire. This is the arcade's answer
to two different problems — pacing the opening of a level, and preventing a stalemate — and it is the
piece of Pac-Man most often left out of a re-implementation.

### 12.1 Personal dot counters

**[Dossier, "Home sweet home"]** Each ghost waiting in the house has a counter of dots eaten this
level, and leaves when it reaches its personal limit:

| Level | Pinky | Inky | Clyde |
| ----- | ----- | ---- | ----- |
| 1     | 0     | 30   | 60    |
| 2     | 0     | 0    | 50    |
| 3+    | 0     | 0    | 0     |

Blinky's limit is 0 at every level: he begins outside the house, and only ever waits in it after being
eaten.

A limit of **0 means "immediately"** — Pinky leaves before the first dot of every level — so the
comparison is `counter >= limit`, never `>`. Off by one here releases every ghost one dot late.

### 12.2 The global counter, after a life is lost

**[Dossier, "Home sweet home"]** Losing a life switches the machine to a **global** dot counter, and
the personal counters are **ignored entirely** while it is active:

| Ghost | Global limit |
| ----- | ------------ |
| Pinky | 7            |
| Inky  | 17           |
| Clyde | 32           |

**Deferred, deliberately:** the Dossier also records that the global counter is _deactivated_ once it
reaches 32 with Clyde inside the house, and that an eaten dot increments the personal counter of the
highest-priority ghost currently in the house. Both are state transitions rather than decisions, so
they belong to the house **system** (slice s11). `src/core/ghost/house.ts` owns only the question "who
may leave this frame", plus the two counter transitions that have nowhere else to live.

### 12.3 The four-second timer

**[Dossier, "Home sweet home"]** If Pac-Man eats **nothing** for long enough, the ghost with the
highest release priority still in the house is released regardless of any counter. The timer resets
every time a dot is eaten.

| Levels | Seconds | Frames (section 1) |
| ------ | ------- | ------------------ |
| 1–4    | 4       | 240                |
| 5+     | 3       | 180                |

Without this rule a player who parks in a corner and stops eating faces one ghost forever — the
deadlock the original added the timer to prevent.

### 12.4 Order and rate

**[Dossier]** The house releases **Pinky, then Inky, then Clyde** — `GHOST_ORDER` minus Blinky, and
the same order as everything else keyed by ghost.

**[repo convention]** `releaseDecision` names **at most one ghost per frame**: the earliest ghost in
`GHOST_ORDER` that is both still in phase `InHouse` and eligible. Naming one rather than a list makes
"all three pour out together" impossible to express, and it costs nothing — the frames are 1/60 s
apart.

**[repo convention]** Only phase `InHouse` is a candidate. A ghost already in `LeavingHouse` is
walking out through the door and must not be released a second time.

---

## 13. Outcomes: points, the ghost ladder, the extra life, the fruit, collision and lives

Added by slice **s08**. Section 8's "what this file does not cover" table previously deferred every
number below; the row is now gone because they are here.

Numbered **13** rather than 9, which is the number it originally carried. Section 9 is already "The
turn decision", and `choose-direction.test.ts` cites _its_ 9.1 for the no-reversal rule — so two
different rules answered to "section 9.1" and a reader following a citation could land on either.
The next free top-level number removes the ambiguity, which is the whole point of citing a section.

This is the section a reader should be most suspicious of, so the tags do more work than usual. The
Dossier states the point values and the fruit triggers outright, and those rows are quoted verbatim.
It does **not** state the extra-life threshold, the exact fruit lifetime, or what happens when a
second energizer is taken while the ghosts are still blue — those three are `[repo convention]`, and
each one says what fixes it.

### 13.1 Eating: 10 for a dot, 50 for an energizer

**[Dossier, "Scoring"]**, quoted verbatim:

> "The 240 small dots are worth ten points each, and the four large, flashing dots—best known as
> _energizers_—are worth 50 points each."

| Eaten     | Points |
| --------- | ------ |
| dot       | **10** |
| energizer | **50** |

A full board is therefore `240 × 10 + 4 × 50 = 2600` points before a single ghost or fruit is
counted. That total is not asserted anywhere yet, but it is the arithmetic a replay fixture's exact
score is built from, which is why the two numbers are worth their own test rather than being trusted
to a constant nobody reads.

The charter's worked example of a legitimate test change — _"power pellet is 50, not 40"_ — is about
this row. `src/core/rules/points.ts` holds both values and nothing else holds either.

### 13.2 The ghost ladder: 200, 400, 800, 1600

**[Dossier, "Scoring"]**, quoted verbatim:

> "The first ghost captured after an energizer has been eaten is always worth 200 points. Each
> additional ghost captured from the same energizer will then be worth twice as many points as the
> one before it—400, 800, and 1,600 points, respectively."

| Ghosts eaten so far this fright | Value of the next one |
| ------------------------------- | --------------------- |
| 0                               | **200**               |
| 1                               | **400**               |
| 2                               | **800**               |
| 3                               | **1600**              |

A complete chain of four is **3000** points — the largest single scoring opportunity in the game, and
the thing skilled play is organised around. A linear ladder (200/400/600/800) would total 2000, look
entirely plausible on screen, and quietly delete that.

**[repo convention]** — the cap. `ghostPoints` is a total function of an integer, and the game cannot
produce a fifth ghost in one fright, so the input is unreachable rather than illegal. It returns the
**1600** cap rather than `undefined`: under `noUncheckedIndexedAccess` an off-the-end array index
would hand `addScore` an `undefined`, and `NaN + anything` is `NaN` for the rest of the game.

**[repo convention]** — **when the ladder resets.** It resets when the **fright period ends**, not on
each energizer eaten. The two rules differ in exactly one situation: an energizer taken while the
ghosts are **already blue**. Under this rule the fright timer is refreshed and the ladder keeps
climbing (a player who has eaten two ghosts is still on 800); under "reset per energizer" it would
drop back to 200.

A reader checking this against the Dossier sentence quoted above **will find "the first ghost
captured after an energizer is always worth 200"**, which reads as the other answer. That is expected,
and this paragraph is why. The Dossier is describing the ordinary case — an energizer taken with no
fright running, where both rules agree — and does not address the overlap anywhere on the page; it
was checked, not assumed. This codebase treats an overlapping energizer as _extending_ one fright
rather than starting a second, because the fright timer is one global counter (section 4) and a
second fright would have to interrupt the first. The rule lives in
`src/core/rules/ghost-combo.ts` and is pinned by a named test, so if a ROM disassembly ever settles
it, exactly one test fails and exactly one line changes.

Eating a ghost does **not** reset the ladder — that is what "each additional ghost" means — and
neither does starting a new level: a level begins with no fright running, so the ladder is already at
its first rung for the ordinary reason.

### 13.3 The extra life: one, at 10000 points

**10000 points, awarded once per game.** _[repo convention]_

The cabinet's DIP switches offer a bonus life at 10000, 15000, 20000 or never; **10000 is the factory
setting**, and it is what a player meets in an arcade. The Dossier page consulted for this document
does not tabulate it — that was checked rather than assumed — so it is recorded here as a machine
setting this codebase fixes at the factory default, exactly as section 7.1 fixes the starting lives
at three.

**[repo convention]** — it is a **crossing**, not a threshold. `addScore(score, points)` reports
`extraLifeAwarded` true only when the addition takes the score from below 10000 to 10000 or above.
Two wrong readings are both easy to write and both visible in play:

| Wrong reading     | What ships                                                                     |
| ----------------- | ------------------------------------------------------------------------------ |
| `after >= 10000`  | a life awarded on every scoring event after 10000; the player ends with ninety |
| `after === 10000` | no life at all when a 1600-point chain leaps from 9000 to 10600                |

The second is the interesting one, because it looks correct and only fails for players good enough to
score in large jumps.

### 13.4 The bonus fruit: 70 and 170 dots, then 9 to 10 seconds

**[Dossier, "Bonus fruits"]** The bonus item appears **twice per level**, triggered by the number of
dots **eaten** — not by a clock, and not by dots remaining:

| Appearance | Dots eaten |
| ---------- | ---------- |
| first      | **70**     |
| second     | **170**    |

There is no third. With 244 edible tiles on the board (section 8.1) a level that runs to completion
therefore offers exactly two bonuses.

**[Dossier, "Bonus fruits"]**, quoted verbatim, on how long it stays:

> "Whenever a fruit appears, the amount of time it stays on the screen before disappearing is always
> between nine and ten seconds. The _exact_ duration (i.e., 9.3333 seconds, 10.0 seconds, 9.75
> seconds, etc.) is variable and does not become predictable."

**[repo convention]** We use a **fixed 570 frames** — 9.5 seconds at 60 frames per second (section
1), the midpoint of the Dossier's range. The alternative, drawing the duration from the injected
`Rng`, would consume the same random stream the frightened ghosts turn on, so the number of draws
taken per level would depend on how quickly the player ate the seventieth dot and two replays of the
same input log would diverge. Determinism is worth more here than half a second of variety, and the
half-second is not observable without a stopwatch.

**[repo convention]** — expiry is an **edge**, on the same terms as `frightenedEnded` in section 4:
`stepFruit` reports the fruit expired on the single frame its counter reaches zero, and reports
nothing on every frame afterwards. A level reports it once or not at all.

**Fruit points are per level and are already tabulated** — the `Fruit` and `Points` columns of
section 3, from cherry at 100 up to key at 5000. They are **not** restated as a second table keyed by
fruit kind: two tables of the same fact are two things to keep in step, and the level table is where
the arcade itself prints them. `LevelSpec.fruitPoints` is the single source, so a level-1 cherry is
100 points because row 1 says so.

### 13.5 Collision: one tile, three outcomes

**[Dossier, "Ghost/Pac-Man collisions"]**, quoted verbatim:

> "Any time Pac-Man occupies the same tile as a ghost, he is considered to have collided with that
> ghost and a life is lost."

Tile occupancy, not pixel distance, and it is compared **after** everything has moved. Three outcomes
exhaust the rule:

| Situation                                            | Outcome        |
| ---------------------------------------------------- | -------------- |
| same tile, fright timer running, ghost still hunting | ghost eaten    |
| same tile, fright timer at zero                      | Pac-Man caught |
| same tile, ghost is eyes heading home                | nothing        |
| different tiles                                      | nothing        |

The **eyes exemption** is section 6.6's documented divergence made concrete: `isFrightened` returns
true for an eaten ghost while the timer still runs, because fright is a global timer rather than a
per-ghost phase, so the collision rule — which knows the phase — is the one place that has to say
"eyes are neither blue nor edible". Without it a player re-eats the same pair of eyes all the way to
the house door for another 1600 points a time.

**The pass-through is faithful, not a bug.** Because the comparison is made once per frame on whole
tiles, a ghost and Pac-Man that **exchange** adjacent tiles between two frames never occupy the same
tile on any frame, and nothing happens. Adding path-crossing detection to "fix" it would kill Pac-Man
in situations the original let him live, and the difference is invisible until somebody who plays
well notices. The test that pins it is named as reproduced arcade behaviour for exactly that reason.

### 13.6 Losing a life

**[repo convention]**, following from section 7.1's three lives:

| Lives when caught | Result                                                   |
| ----------------- | -------------------------------------------------------- |
| more than 1       | one life spent, the round restarts                       |
| exactly 1         | one life spent, **game over**                            |
| 0                 | still 0, still game over — the count never goes negative |

The zero row is a totality rule rather than an arcade fact: `loseLife` is a pure function of an
integer and something has to be true for every input it can be handed. A negative count would render
as `-1` life icons in the HUD and never reach game over, which makes the game unloseable — a bug that
only appears after the bug that calls `loseLife` twice.

The outcome is reported as a value (`respawn` or `gameOver`), not as a `RoundPhase` and not as a
`GameEvent`. Both of those types live in `src/core/game/` (slice s09), which depends on this slice
and therefore cannot be imported from it. Translating the outcome into a phase change and a
`gameOver` event carrying the final score is `life-system`'s job in slice s11, and is tested there.

---

## 14. What this file does not cover

Numbers owned by other slices, each of which extends this document when it lands:

| Subject                                                     | Slice |
| ----------------------------------------------------------- | ----- |
| The 28×31 board and the four no-up tiles                    | s02   |
| `FULL_SPEED` in sub-pixels, and the carry (section 2 above) | s03   |
