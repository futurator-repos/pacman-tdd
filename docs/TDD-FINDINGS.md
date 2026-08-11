# What building this taught about TDD

**Findings from scaffolding one codebase test-first, written as input to designing a TDD-centred
development pipeline.**

This is not a summary of TDD literature. Everything here was produced by, or paid for during, the
construction of this repository's scaffold — six red→green cycles, three genuine defects caught, and
one process violation committed by the author and caught by a script.

Companion documents: [`TDD-CHARTER.md`](TDD-CHARTER.md) describes the process as enforced here. This
document is about what the experience revealed.

---

## The thesis

> **TDD's value is not that tests exist. It is that the test was written while you still did not know
> the answer.**

Everything below follows from protecting that ignorance. Each failure mode is a way the ignorance
leaks — you learn the answer first, then write a test shaped around it, and the test's ability to
detect a mistake dies quietly at that moment.

This reframing matters for pipeline design, because it means the process must protect a _temporal_
property. You cannot inspect a finished test suite and determine whether it was written test-first.
You can only observe the order as it happens, or record it in something tamper-evident.

---

## The five failure modes

Each was observed in this session. Each has a mechanical control, because a control that relies on
the executor's diligence is not a control.

| #   | Failure                  | What it looks like                                           | Control                                                    |
| --- | ------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| 1   | Fake red                 | Fails with `Cannot find module`. Zero tests ran.             | Require an **assertion** failure. Needs a signature stub.  |
| 2   | Vacuous pass             | Loops an empty collection; body never runs; reports success. | `expect.assertions(n)`; run new tests against a null impl. |
| 3   | Test bent to fit code    | Test edited during implementation until green.               | `git diff --exit-code <RED> <GREEN> -- '*.test.ts'`        |
| 4   | Contaminated commits     | `git add -A` sweeps implementation into a `[RED]` commit.    | Path-scoped staging; a checker that reads `git log`.       |
| 5   | Tautological expectation | Expected value derived from what the code happens to do.     | Every test cites an **external** source of truth.          |

### 1. Fake red

The first test run of the project failed with `Cannot find module './direction.ts'` and reported
**"0 test"**. Nothing executed.

That failure is worthless as evidence. It would have occurred identically if every `expect` in the
file had been deleted. A red phase that proves nothing about the assertions has not happened yet.

The fix is a **signature-only stub**: declare the types, return inert values, add no behaviour. Now
the tests run and fail with real expected-vs-received diffs.

This is the one place the "no implementation before the test" rule genuinely bends, and it is worth
bending. The rule that keeps it honest: **the stub must not make a single assertion pass that ought
to be failing.**

### 2. Vacuous pass

With the stub in place, the geometry suite reported **9 failed, 5 passed**.

Five passes against an implementation that does nothing is a warning, and three of them were real
defects:

```ts
it('returns unit vectors for every direction', () => {
  for (const direction of ALL_DIRECTIONS) {   // stub returns []
    expect(...).toBe(1);                      // never executes
  }
});                                            // reports SUCCESS
```

The loop body never ran. The test asserted nothing and passed. Adding `expect.assertions(4)` turned
9 red into **12 red**.

This is vacuous truth, and it is the most dangerous test defect because such a test looks completely
normal, passes forever, and silently protects nothing.

### 3 & 4. Process violations — including the author's

The charter promised that `[RED]` commits contain only tests. The author then violated it three
times with `git add -A`, and **did not notice**. A 60-line script reading `git log` caught it:

```
✗ TDD history check failed:
  - 7c2ffe4 "test(render): ... [RED]" has no following [GREEN] commit
  - d7bfc84 "test(render): ... [RED]" has no following [GREEN] commit
  - 335e232 "test(platform): ... [RED]" has no following [GREEN] commit
```

Two commits labelled `[RED]` secretly contained the previous slice's implementation. They were
rewritten into honest pairs before anything was pushed.

The generalisable lesson is the most important one in this document:

> **Whoever is following a process is the least reliable auditor of that process.**

Not through dishonesty — through the ordinary blindness of being inside the work. Instructions
degrade under pressure, fatigue and momentum. Scripts do not.

For a pipeline: never accept "the agent reports it followed TDD." Accept only "the history
demonstrates it." See [`scripts/verify-tdd-history.js`](../scripts/verify-tdd-history.js).

### 5. The oracle problem

Where does the expected value come from?

If it comes from the implementation, the test is a tautology wearing a disguise — and this is the
hardest defect to detect, because such tests look perfectly ordinary and pass indefinitely.

Sources of truth, weakest to strongest:

1. Someone's judgement — a preference dressed as a fact
2. A written specification — decent
3. **An externally documented oracle** — strong
4. A reference implementation to differential-test against — strongest

Choosing arcade-accuracy was, in hindsight, the highest-leverage decision in the entire design — not
for authenticity, but because _"Pinky targets four tiles ahead of Pac-Man"_ is a checkable fact about
the world that cannot be back-fitted to code that does not exist yet.

**Recommendation: require every test to declare its oracle.** A test whose expected value has no
source outside the codebase is a smell.

---

## The most useful discovery: the stub is a measuring instrument

The stub was introduced to escape failure mode 1. It turned out to be worth far more than that.

**A do-nothing stub is a test-quality oracle.** Run new tests against it and classify every result:

```
FAILS against the stub  →  pins real behaviour. Load-bearing.
PASSES against the stub →  suspicious. Exactly one of:
   (a) vacuous   — never executed its assertion        → DEFECT. Fix it.
   (b) weak      — trivially satisfied by a constant   → keep as a guard; pins nothing
   (c) invariant — genuinely true of all implementations → legitimate
```

Observed twice, with different outcomes:

| Slice    | Result vs. stub    | Diagnosis                                                           |
| -------- | ------------------ | ------------------------------------------------------------------- |
| Geometry | 9 failed, 5 passed | 3 were **(a) vacuous** — real defects, fixed. 12 red after.         |
| RNG      | 4 failed, 6 passed | All 6 were **(b) weak** — "same seed, same sequence" holds for `0`. |

The classification takes seconds and is the only cheap way found to detect a worthless test _before_
it becomes load-bearing. It belongs in the pipeline as a gate.

### The corollary: not every test should fail in the red phase

This contradicts the usual framing, and the RNG slice is the counterexample. "Values stay within
`[0, 1)`" _should_ hold for every implementation including a broken one. It is a guard, not a
specification. It is worth keeping and it is worth knowing it pins nothing.

So the rule is narrower than "all tests must fail":

> **For each behaviour being added, at least one test must fail for the right reason — and you must
> be able to name which one.**

If you cannot name the load-bearing test, the behaviour has not been specified.

---

## Testability is an architecture decision, not a testing skill

Every "how do I test this?" problem encountered dissolved into a design change, not a testing
technique:

| Problem                  | Not solved by          | Solved by                               |
| ------------------------ | ---------------------- | --------------------------------------- |
| Canvas needs a browser   | headless canvas, mocks | A two-method `DrawSurface` interface    |
| Game rules need a clock  | fake timers            | Time as an explicit `deltaMs` parameter |
| Ghosts need randomness   | seeding globals        | An injected `Rng` interface             |
| Manifest is untyped JSON | casting                | Validating once at the boundary         |

> **If something is hard to test, that is a design signal, not a testing problem.**

Mocking frameworks are, in this light, mostly a way to avoid hearing that signal.

### Corollary: architecture rules must be executable

"`core` imports nothing outside itself" was written as an ESLint rule, and purity was additionally
enforced by running those tests in an environment where `document` does not exist. Both were then
verified by writing a deliberately illegal file and watching them fire:

```
core/_boundary-probe.ts
  1:23  error  Unexpected path "../render/_probe.ts" imported in restricted zone
  3:47  error  'Math.random' is restricted from being used
  4:46  error  'Date.now' is restricted from being used
  5:45  error  Unexpected use of 'document'
  6:30  error  Unexpected any
```

**A rule you have never seen fail is a rule you are assuming.** The same applies to coverage
thresholds, which were verified by adding an uncovered function and confirming the build broke.

---

## Test types: the blind spots matter more than the definitions

| Type              | Answers                         | Blind to                                     |
| ----------------- | ------------------------------- | -------------------------------------------- |
| Unit              | does this piece work?           | integration between pieces                   |
| Integration       | do the pieces cooperate?        | real-environment behaviour                   |
| Property-based    | does the invariant always hold? | whether the invariant is the right one       |
| Snapshot          | did this output change?         | whether the output was ever correct          |
| Visual regression | did the pixels change?          | **whether the pixels were ever right**       |
| E2E               | does the user flow work?        | why it broke; and it is slow and flake-prone |

The visual-regression blind spot generalises to every golden-file technique:

> **A baseline detects change, never wrongness.** A first baseline showing a green Pac-Man would be
> faithfully protected forever.

**Therefore every golden-file test needs a one-time human acceptance step.** In this project the
sprite atlas and the visual baseline were each rendered and inspected by eye before being committed.
That step is not optional and cannot be automated away.

---

## Sabotage: the only honest grade on a suite

Coverage says a line executed. It does not say anything checked the result. A suite can reach 100%
coverage with zero assertions.

Rendering was deliberately disabled in `main.ts`. Three of the four rendering tests failed — blank
canvas, missing yellow pixel, visual baseline mismatch. **The fourth passed**: "keeps sprite edges
hard" is trivially satisfied by a blank canvas, which contains no interpolated pixels at all.

That is a test which is worthless alone and valuable only alongside the others — and nothing except
sabotage would have revealed it.

This is manual mutation testing. Automating it (Stryker) is the systematic version, and is the
honest answer to "how good is this suite?" It has not been installed here; that remains an open
offer rather than a completed claim.

---

## Where the rule should knowingly bend

`app/main.ts`, the composition root, was wired **before** its tests. It holds no logic — only wiring
— so there was no behaviour to specify in advance beyond "it boots".

This was declared rather than disguised, and those tests were validated by sabotage instead.

A pipeline needs this escape hatch, with two conditions attached:

1. **A stated justification**, recorded in the commit
2. **An alternative verification**, since the normal one was skipped

Without the hatch, people fake compliance and the record becomes worthless. Without the conditions,
the hatch consumes the process.

---

## Proposed pipeline

```
0. ORACLE      Name the source of truth for every expected value.
               No oracle → do not write the test yet.

1. RED         Write tests + signature stub. Run. Capture the output.
               Failure must be an assertion, not a missing module.

2. CLASSIFY    Every test that PASSES against the stub is labelled
               vacuous / weak / invariant. Vacuous ones are defects.   ← cheap, high yield

3. GREEN       Implement. Tests frozen — enforced by diff, not instruction.

4. REFACTOR    Design improves; tests unchanged. A test that must change
               here was coupled to implementation, which is a defect in the test.

5. SABOTAGE    Break the code deliberately. Which tests notice?
               Any that do not are candidates for deletion or strengthening.

6. REGRESSION  Full suite against a recorded baseline. Every test that moved
               is classified: deliberate specification change, or regression.
```

Steps **2** and **5** are absent from every description of TDD the author is aware of, and they are
the two that caught real defects during this scaffold.

### Supporting machinery

| Concern           | Mechanism                                                   |
| ----------------- | ----------------------------------------------------------- |
| Order of work     | separate `[RED]` / `[GREEN]` commits                        |
| Test immutability | `git diff --exit-code` between the pair                     |
| Process integrity | a script reading `git log`, run in CI                       |
| Architecture      | lint rules that fail the build                              |
| Purity            | a test environment where the forbidden globals do not exist |
| Golden files      | one-time human acceptance, recorded                         |
| Suite strength    | sabotage, or mutation testing                               |

---

## Costs, honestly

- The scaffold took far longer than writing the same code untested. Most of that was toolchain
  friction (TypeScript 7 outpacing `typescript-eslint`, five separate lint/tsconfig breakages), not
  the discipline itself.
- Stubs are extra work, and they are load-bearing for the process.
- Strict gates block progress by design. `knip` blocked a push over three unused dependencies; the
  correct response was to finish the work that used them, not to weaken the rule. That judgement
  call recurs constantly and each instance is an opportunity to quietly gut the process.
- 100% coverage on a pure core is achievable. It would not be on code that touches I/O, which is an
  argument for pushing logic into a pure core rather than for lowering the threshold.
