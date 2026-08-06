# Pac-Man — Production Codebase Design

**Date:** 2026-08-06
**Status:** Approved
**Scope of this spec:** the engineering foundation and the walking skeleton. Gameplay features are
directed separately, one at a time, on top of this base.

## 1. Goal

Build an arcade-accurate Pac-Man to the standards of a game studio codebase: strictly typed,
test-driven, with quality gates that fail the build rather than file a warning.

Two constraints shape every decision below.

**Tests come first.** Not as a policy statement — as a structural property. The game's rules live in
code that has no browser, no canvas, and no clock, so a test can drive them directly and assert an
exact result. Where that isn't possible, the boundary is drawn so the untestable part is trivially
small.

**The arcade original is the oracle.** Its behavior is documented in detail, which turns test
expectations into verifiable facts rather than judgment calls. "Pinky targets four tiles ahead of
Pac-Man" is a test. "The ghosts feel smart" is not.

## 2. Architecture

Four layers. Dependencies point in one direction only.

```
┌─────────────────────────────────────────────────────────┐
│  app/        composition root — wires the other three    │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
┌───────────────▼──────────┐  ┌───────────▼───────────────┐
│  platform/               │  │  render/                  │
│  keyboard, audio, RAF,   │  │  reads state → draws      │
│  storage — the impure    │  │  never mutates            │
│  edge                    │  │                           │
└───────────────┬──────────┘  └───────────┬───────────────┘
                │                         │
        ┌───────▼─────────────────────────▼───────┐
        │  core/                                  │
        │  pure, deterministic, dependency-free   │
        │  tick(state, input, rng) → state        │
        └─────────────────────────────────────────┘
```

| Layer | May import | Environment | Coverage gate |
|---|---|---|---|
| `core/` | nothing outside `core/` | node (no DOM exists) | **100%** |
| `render/` | `core/` (types only) | jsdom + stubs | 90% |
| `platform/` | `core/` (types only) | jsdom + stubs | 90% |
| `app/` | all | Playwright only | e2e |

### 2.1 The rules are enforced, not documented

`import/no-restricted-paths` fails the build on a violating import. `core/` unit tests run in
Vitest's node environment where `document` and `window` do not exist, so a stray DOM reference
cannot even run. Nothing may import `app/`.

### 2.2 Determinism

`core/` may not call `Date.now()`, `performance.now()`, or `Math.random()` — banned by
`no-restricted-globals` and `no-restricted-properties`.

- Time enters as an explicit `deltaMs` parameter.
- Randomness enters as an injected seeded `Rng` interface (frightened-ghost movement is the only
  consumer).

The payoff: a test can run ten thousand ticks and assert an exact final state. Bugs reproduce from a
seed and an input log rather than from a description of what someone saw.

## 3. Asset pipeline

Pixel art is authored as data, not as binary blobs.

```
assets/source/*.sprites.ts        typed pixel grids — readable, diffable, reviewable
        │
        │   pnpm assets:build      scripts/build-atlas.ts (pngjs — pure JS, no native deps)
        ▼
public/assets/atlas.png + atlas.json        generated, committed
```

A sprite source is a palette plus rows of single-character pixel keys:

```ts
export const pacmanRight1: SpriteSource = {
  name: 'pacman-right-1',
  palette: { _: null, Y: '#FFFF00' },
  pixels: [
    '_____YYYYYY_____',
    '___YYYYYYYYYY___',
    // ...16 rows of 16
  ],
};
```

**Validation is a test, not a build warning.** Every sprite must be 16×16, every row must match the
declared width, and every character must exist in the palette. `pnpm assets:check` regenerates the
atlas and fails if the result differs from what is committed — catching both a stale atlas and a
hand-edited PNG.

Palette is the arcade's: Pac-Man `#FFFF00`, Blinky `#FF0000`, Pinky `#FFB8FF`, Inky `#00FFFF`,
Clyde `#FFB852`, maze blue `#2121FF`, frightened `#2121FF`/`#FFFFFF`.

## 4. Test strategy

| Tier | Tool | Covers | Gate |
|---|---|---|---|
| Unit | Vitest (node) | `core/` — rules, ghost AI, collision, scoring | 100% coverage |
| Component | Vitest (jsdom) | `render/`, `platform/` against stubs | 90% coverage |
| E2E | Playwright | real browser: boot, input, visual snapshot | must pass |

### 4.1 Testing the renderer without a canvas

`CanvasRenderer` depends on a narrow `DrawSurface` interface (`clear`, `drawSprite`, `fillRect`) —
not on `CanvasRenderingContext2D`. Unit tests pass a recording stub and assert the exact sequence of
draw calls. No headless canvas, no native dependencies, no flakiness.

Actual pixels are verified by Playwright screenshot comparison, which is the right tool for that
question.

### 4.2 Allure

`allure-vitest` and `allure-playwright` write to `allure-results/`. Both tiers merge into one report,
generated in CI by the Allure GitHub Action and published to GitHub Pages.

Report generation requires a Java runtime, which this machine does not have. Locally, tests emit raw
results; `pnpm allure:report` exists and reports the missing prerequisite clearly instead of failing
cryptically. Installing a JRE later enables it with no config change.

Tests carry Allure metadata — `epic`, `feature`, `severity`, and a link to the relevant spec section —
so the report reads as a description of behavior rather than a list of function names.

### 4.3 TDD discipline

Every feature starts with a failing test. A green suite proves tests pass; it does not prove they can
fail. So the scaffold's final step deliberately breaks a test, captures the red output, and reverts —
demonstrating the pipeline actually detects failure.

## 5. Quality gates

**TypeScript** — `strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`.

**`any` is an error**, along with the whole `no-unsafe-*` family, so a value cannot be laundered
through `any` and used anyway. The escape hatch is `unknown` plus a type guard. Test files are held to
the same standard — no relaxed tsconfig for tests.

**ESLint 9** flat config: `typescript-eslint` strict-type-checked + stylistic, layer boundaries, the
determinism bans, and the `vitest` / `playwright` plugins.

**Knip** — unused files, exports, types, and dependencies, all at error level, in CI.

**Husky**

| Hook | Runs | Why |
|---|---|---|
| `pre-commit` | lint-staged (eslint --fix, prettier) | fast, staged files only |
| `commit-msg` | commitlint — conventional commits | keeps history machine-readable |
| `pre-push` | typecheck + test + knip | the real gate |

**CI** (GitHub Actions): typecheck → lint → knip → assets:check → unit → e2e → publish Allure report.

## 6. Walking skeleton

The scaffold ends with one thin slice through every layer — proving the pipeline works before any
gameplay is written.

- `core/geometry` — `Direction`, `Vector2`, grid↔pixel conversion, fully tested
- `core/rng` — seeded `Rng`, tested for reproducibility
- One sprite (Pac-Man facing right) through the complete asset pipeline
- `render/CanvasRenderer` drawing it, unit-tested against the recording stub
- `app/main.ts` booting a 224×288 canvas, integer-scaled, nearest-neighbour
- One Playwright test: page loads, canvas present, canvas not blank, snapshot matches

Explicitly **not** included: maze, ghosts, gameplay. Those are directed separately.

## 7. Deferred

Recorded so they are choices rather than oversights: sound, high-score persistence, multiple levels,
cut-scenes, mobile/touch input, gamepad support.

## 8. Decisions

| Decision | Chosen | Rationale |
|---|---|---|
| Architecture | pure TS core + canvas renderer | maximum testable surface, minimum untestable edge |
| Assets | generated from typed pixel data | diffable, reviewable, testable, regenerable |
| Fidelity | arcade-accurate | documented behavior gives objective test oracles |
| Allure reports | results locally, report in CI | avoids a Java dependency on the dev machine |
| Package manager | pnpm | already installed; strict node_modules |
| Scaffold scope | tooling + walking skeleton | proves every layer before feature work |
