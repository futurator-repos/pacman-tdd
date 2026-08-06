# The TDD Charter

**How this codebase is built, and how you can verify the claims rather than trust them.**

This document exists because the goal of this project is not really Pac-Man. The goal is a worked
example of test-driven development that someone new to testing can read, follow, and check.

Three plans will be executed in sequence:

1. **Plan 1 (greenfield)** — build features on empty ground. Every feature arrives test-first.
2. **Plan 2 (brownfield)** — change existing code. Plan 1's tests become the safety net, and we watch
   them do their job.
3. **Plan 3** — same again, on a larger surface.

The interesting part is plan 2. Anyone can write tests for new code. The question TDD actually
answers is: _when I change this six weeks later, will I know if I broke it?_

---

## Part 1 — The challenge

Four things can go wrong in an AI-run TDD process. Each one gets a mechanical defence, because a
promise from an agent is not a control.

### Challenge 1: The agent writes the code first, then the tests

**Why it matters.** Tests written after the code tend to describe what the code _does_, not what it
_should do_. They pass on day one and catch nothing thereafter.

**The defence: separate commits, verified by timestamp order in git.**

Every slice of work produces at least two commits:

```
test(ghost-ai): pinky targets four tiles ahead of pacman [RED]
feat(ghost-ai): implement pinky targeting [GREEN]
```

The RED commit contains the tests, plus at most a **signature-only stub** — and the suite is failing
at that commit.

The stub needs justifying, because it is the one place this process bends. A test that fails with
`Cannot find module` has demonstrated nothing about its own assertions; it fails for a structural
reason, and would fail identically if every `expect` in it were deleted. To get an _honest_ red — a
real expected-vs-received diff — the module has to exist and the test has to execute.

So the stub declares the correct types and returns deliberately inert values (`{x: 0, y: 0}`,
`false`, `[]`). It contains **no behaviour**. This is Kent Beck's "make it compile, then make it
pass", and the rule that keeps it honest is that the stub must not make a single assertion pass that
should be failing.

This actually happened here, and it is worth reading. The first red produced 9 failures and **5
passes**. Three of those passes were vacuous: they looped over `ALL_DIRECTIONS`, the stub returned
`[]`, the loop body never ran, and the assertion inside it was never evaluated. The tests were
reporting success while checking nothing. Adding `expect.assertions(4)` turned them into honest
failures — 12 red instead of 9.

That is the RED phase earning its keep: it found three worthless tests before a line of real code
existed. See `docs/tdd-evidence/01-geometry-direction-RED.log` for the captured output.

You can check any RED commit yourself, and so can CI:

```bash
git checkout <RED_SHA>
pnpm test            # must FAIL
git checkout <GREEN_SHA>
pnpm test            # must PASS
```

If the RED commit passes, the test was worthless. If the RED commit contains implementation files,
the order was faked. Both are detectable by anyone reading the repo.

### Challenge 2: The agent changes the test to make it pass

This is the failure mode that destroys the whole exercise, and the one worth the strongest control.

**The defence: the test files are frozen between RED and GREEN, enforced by diff.**

The implementer is a _different agent_ from the test author, and is told the tests are frozen. But
instructions are not enforcement. After the GREEN step, a verifier runs:

```bash
git diff --exit-code <RED_SHA> HEAD -- '**/*.test.ts' '**/*.spec.ts'
```

A non-zero exit means a test file changed during implementation. The slice **fails and is redone from
the RED commit.** The same check runs in CI, so it holds whether or not anyone is watching.

**Tests are not permanently immutable** — that would be its own pathology. A test can change, but only
in its own commit, with a stated reason:

```
test(scoring): power pellet is 50 points, not 40

The original test asserted 40. Verified against the arcade ROM
disassembly: power pellets are 50. The test was wrong, not the code.
```

The rule is not _never change a test_. The rule is **never change a test silently, and never inside a
green step.**

### Challenge 3: The tests are badly written

A green suite of bad tests is worse than no tests, because it produces confidence without safety.

**Defence A — the expectation comes from outside the code.** This is why the project is
arcade-accurate. Expected values are taken from documented original behavior, so they cannot be
back-fitted to whatever the implementation happens to produce. "Pinky targets four tiles ahead" is a
fact about Pac-Man; it is not an opinion about our code.

**Defence B — an adversarial review before implementation exists.** A VERIFY-RED agent checks each
test against a checklist:

- Does it fail on the **assertion**, not on `Cannot find module`? A test that fails because the file
  doesn't exist has proven nothing about its assertion. This is the single most common fake red.
- Does it assert **behavior** or **implementation**? `expect(score).toBe(50)` is behavior.
  `expect(addScoreSpy).toHaveBeenCalled()` is implementation, and it will block every future
  refactor.
- Is the failure message **useful**? A good red tells you what was expected and what happened.
- Is it **deterministic**? No real clock, no unseeded randomness, no dependence on test order.

**Defence C — mutation testing, the objective grade.** Coverage is a weak metric: it proves a line
_executed_, not that anything checked the result. A test suite can have 100% coverage and zero
assertions.

Mutation testing (Stryker) deliberately breaks the source — flips `<` to `<=`, swaps `+` for `-`,
deletes a line — and re-runs the tests. If the tests still pass, that mutant **survived**, which means
a real bug of that exact shape would ship unnoticed.

```
Coverage:       "this line ran during a test"        (weak)
Mutation score: "a test would have caught this bug"  (strong)
```

This is the only honest answer to "how well is the TDD done here?"

### Challenge 4: Plan 2 quietly breaks plan 1

**The defence: a recorded baseline, and a forced classification of every failure.**

Before plan 2 modifies a single file, the full suite runs and the result is committed as a baseline —
test count, pass count, coverage, mutation score. It runs again after. Both numbers are published.

When a plan-1 test fails during plan-2 work, there are exactly two possibilities, and collapsing them
is how regressions ship:

|         | What happened                                                                            | Correct response                                                            |
| ------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **(a)** | The behavior legitimately changed. The old test encoded a rule we deliberately replaced. | Update the test in **its own commit**, with the justification written down. |
| **(b)** | We broke something.                                                                      | **Fix the code.** Leave the test alone.                                     |

Every such failure will be labelled (a) or (b) explicitly. If a test is ever edited during plan 2
without that label, treat it as a defect in the process.

---

## Part 2 — Types of tests, and what each is for

Written for someone new to testing. Every type listed here appears in this repository, so each
description points at something real you can go read.

The organising idea is the **test pyramid**: many fast tests that check small things, fewer slow tests
that check big things. Fast tests tell you _exactly_ what broke. Slow tests tell you _that the whole
thing works_. You need both, in that ratio, because a suite of only slow tests takes twenty minutes
and everyone stops running it.

```
        /\          E2E + Visual        few, slow (~5s), high confidence
       /  \         "does the real thing work for a real user?"
      /----\
     /      \       Integration         some, medium (~10ms)
    /        \      "do the parts work together?"
   /----------\
  /            \    Unit                many, instant (~1ms)
 /______________\   "does this one piece work?"
```

### Unit test

**Question:** does one small piece of logic do the right thing, on its own?

The workhorse. Fast enough that you run thousands on every save. When one fails, you know exactly
which function is wrong — no detective work.

```ts
it('targets four tiles ahead of pacman', () => {
  const target = pinkyTarget({ tile: { x: 10, y: 20 }, facing: Direction.Up });
  expect(target).toEqual({ x: 10, y: 16 });
});
```

Note what this does _not_ do: no browser, no canvas, no game loop, no ghosts other than the one rule
under test. That isolation is the whole point, and it's why `core/` is written with no dependencies.

### Integration test

**Question:** do several pieces work correctly _together_?

Units passing individually does not mean they cooperate. Movement may be right and collision may be
right while the order they run in is wrong.

```ts
it('eating a pellet increases score and removes it from the maze', () => {
  const before = stateWithPelletAt({ x: 5, y: 5 });
  const after = tick(before, { input: Direction.Right, deltaMs: 16 });
  expect(after.score).toBe(10);
  expect(after.maze.pelletAt({ x: 5, y: 5 })).toBe(false);
});
```

One tick, several subsystems, one observable outcome.

### Property-based test

**Question:** does a rule hold for _every_ input, not just the three I thought of?

You state an invariant; the framework (fast-check) generates hundreds of random inputs trying to break
it. When it finds a failure it shrinks it to the smallest reproducing case.

```ts
it('pacman never leaves the maze, whatever the input sequence', () => {
  fc.assert(
    fc.property(fc.array(arbitraryDirection(), { maxLength: 500 }), (inputs) => {
      const final = inputs.reduce((s, d) => tick(s, { input: d, deltaMs: 16 }), newGame());
      expect(maze.contains(final.pacman.tile)).toBe(true);
    }),
  );
});
```

This is where the "no `Math.random()` in core" rule pays for itself: the same seed reproduces the same
failure, every time.

### Snapshot test

**Question:** did this structured output change without anyone intending it?

Serialize a value, commit the result, compare on every run. Excellent for generated artifacts like the
sprite atlas manifest. Dangerous if overused — a snapshot nobody reads is just a rubber stamp, and the
temptation to run `--update` on a real failure is strong.

### Component test

**Question:** does the renderer emit the right drawing instructions?

Our renderer talks to a narrow `DrawSurface` interface rather than a real canvas, so a test can pass a
recording stub and assert the exact call sequence — no browser required.

```ts
it('draws blinky at his pixel position', () => {
  const surface = recordingSurface();
  renderGhosts(surface, stateWithBlinkyAt({ x: 2, y: 3 }));
  expect(surface.calls).toEqual([{ op: 'drawSprite', name: 'blinky-right-1', x: 16, y: 24 }]);
});
```

### Smoke test

**Question:** is it standing up at all?

A tiny, fast subset run before the expensive suite. If the page doesn't load, there's no point
spending four minutes discovering that all 300 e2e tests also fail. Named after hardware testing: plug
it in, see if smoke comes out.

### End-to-end (E2E) test

**Question:** does a real user flow work, in a real browser, against the real build?

Playwright drives actual Chrome. The most realistic tests, and the most expensive — slow, and prone to
flaking on timing. Keep them few and reserve them for flows that genuinely span everything.

```ts
test('pressing left moves pacman left', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-testid="pacman-x"]')).toHaveText('13');
});
```

### Visual regression test

**Question:** did the rendered pixels change?

Playwright screenshots the canvas and diffs it against a committed baseline image. Essential for pixel
art, where a bug may be visually obvious but invisible to every assertion — a one-pixel sprite offset
breaks no logic and fails no unit test.

**Its limitation matters:** it detects _change_, not _wrongness_. If the first baseline shows a green
Pac-Man, it will faithfully protect that green Pac-Man forever. Which is why we also have:

### Agent visual QA

**Question:** is this actually _correct_ — not merely unchanged?

I open the running game in Chrome, look at it, and compare against the specification: Pac-Man yellow,
maze blue, sprites crisp rather than blurred, nothing clipped at the edges. A human-style judgement
that no assertion encodes.

This is the step that catches "the baseline was wrong from the start." It runs as an explicit phase of
each plan, and it is where the browser tooling is used.

### Performance test

**Question:** is it fast enough to hit 60 frames per second?

A frame has ~16ms. If a tick takes 20ms, the game is broken no matter how correct it is.

```ts
it('completes a tick within the frame budget', () => {
  expect(median(measureTicks(1000))).toBeLessThan(2);
});
```

### Regression test — a purpose, not a type

Any test above becomes a regression test the moment its job is to stop a _fixed_ bug from returning.
Every bug found gets a failing test reproducing it _before_ the fix — that's TDD applied to debugging,
and it's why the same bug shouldn't ship twice.

**Plan 1's entire suite becomes plan 2's regression suite.** That is the point of the exercise.

---

## Part 3 — How each plan will be executed

Every plan runs as the same six-phase cycle. Phases appear by name in the live progress view, so the
red→green transition is visible while it happens rather than summarised afterwards.

```
  ┌──────────────────────────────────────────────────────────────┐
  │ 0. BASELINE      run full suite, record counts + coverage    │
  ├──────────────────────────────────────────────────────────────┤
  │ 1. RED           write failing tests. Run them. Capture the  │
  │                  actual failure output. Commit [RED].        │
  ├──────────────────────────────────────────────────────────────┤
  │ 2. VERIFY-RED    adversarial agent: is each red honest and   │
  │                  well-formed? Fails on assertion, not import?│
  ├──────────────────────────────────────────────────────────────┤
  │ 3. GREEN         minimum implementation. Tests frozen.       │
  │                  Verified by git diff. Commit [GREEN].       │
  ├──────────────────────────────────────────────────────────────┤
  │ 4. REFACTOR      improve design, suite stays green,          │
  │                  tests unchanged.                            │
  ├──────────────────────────────────────────────────────────────┤
  │ 5. REGRESSION    full suite + gates. Compare to baseline.    │
  │                  Classify any moved test as (a) or (b).      │
  ├──────────────────────────────────────────────────────────────┤
  │ 6. VISUAL QA     drive the real game in Chrome. Screenshot.  │
  │                  Judge against spec, not against baseline.   │
  └──────────────────────────────────────────────────────────────┘
```

Independent slices run these cycles in parallel, each in its own git worktree so they cannot corrupt
each other. Within a slice the order is strict: no implementation exists before its test has been
seen to fail.

### On the pre-push hook

The quality gates include `pre-push → typecheck + test + knip`. A RED commit fails that hook by
design — its tests are supposed to be failing.

The tempting fix is `git push --no-verify`. **We will not do that**, because a TDD demonstration that
teaches you to bypass your own safety checks has taught you the wrong thing.

Instead: RED and GREEN are committed locally, then pushed **together**. The history preserves the
red→green pair for inspection, every pushed commit passes the hooks, and CI stays green. Nothing is
bypassed and nothing is hidden.

---

## Part 4 — What you can check yourself

You do not have to take any of this on trust. Every claim above has a command:

| Claim                          | How to verify                                                       |
| ------------------------------ | ------------------------------------------------------------------- |
| Tests really came first        | `git log --oneline` — every `feat` has a `test ... [RED]` before it |
| The red was real               | `git checkout <RED_SHA> && pnpm test` → fails                       |
| The test wasn't edited to pass | `git diff <RED_SHA> <GREEN_SHA> -- '**/*.test.ts'` → empty          |
| Tests are meaningful           | `pnpm test:mutation` → mutation score                               |
| Plan 2 broke nothing           | baseline vs. after counts, both published                           |
| The game looks right           | screenshots committed per plan                                      |

If any of these fails to hold, the process failed — and you'll be able to see it.
