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

## 7. What this file does not cover

Numbers owned by other slices, each of which extends this document when it lands:

| Subject                                                       | Slice |
| ------------------------------------------------------------- | ----- |
| The 28×31 board, 240 dots, 4 energizers, the four no-up tiles | s02   |
| `FULL_SPEED` in sub-pixels, and the carry (section 2 above)   | s03   |
| Ghost-house release: 0/30/60 dots, the 7/17/32 globals, 4 s   | s06   |
| Points: 10, 50, the 200/400/800/1600 ladder, the extra life   | s08   |
