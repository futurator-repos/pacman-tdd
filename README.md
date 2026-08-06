# pacman-tdd

An arcade-accurate Pac-Man, built to game-studio codebase standards: strictly typed, test-driven,
with quality gates that fail the build rather than file a warning.

> **Status:** scaffold complete — toolchain, asset pipeline and a walking skeleton, all built
> test-first. No gameplay yet.

The point of this repository is not really Pac-Man. It is a worked example of TDD that you can read
and **check**, rather than take on trust. Start with:

- [`docs/TDD-CHARTER.md`](docs/TDD-CHARTER.md) — how the process is enforced, what each kind of test
  is for, and how to verify every claim here yourself
- [`docs/superpowers/specs/2026-08-06-pacman-tdd-scaffold-design.md`](docs/superpowers/specs/2026-08-06-pacman-tdd-scaffold-design.md) —
  the engineering design

## Architecture

```
app/         composition root — wires the layers, holds no logic
  ├── platform/    keyboard, audio, RAF, storage — the impure edge
  ├── render/      reads state → draws it, never mutates
  └── core/        pure, deterministic, dependency-free game rules
```

`core/` imports nothing outside itself, runs in a test environment where the DOM does not exist, and
may not call `Date.now()` or `Math.random()` — time and randomness are injected. None of that is
convention: each rule is an ESLint rule that fails the build.

The payoff is that the game rules can be driven directly by a test, ten thousand ticks at a time,
and a bug reproduces from a seed instead of from a description of what someone saw.

## Commands

| Command              | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `pnpm dev`           | Vite dev server at http://localhost:5173            |
| `pnpm test`          | Unit and component tests                            |
| `pnpm test:watch`    | Same, in watch mode                                 |
| `pnpm test:coverage` | Tests with coverage thresholds (100% on `core/`)    |
| `pnpm test:e2e`      | Playwright: smoke, rendering and visual tests       |
| `pnpm typecheck`     | `tsc` across app and node projects                  |
| `pnpm lint`          | ESLint, including the architecture rules            |
| `pnpm knip`          | Unused files, exports, types and dependencies       |
| `pnpm assets:build`  | Compile sprite sources into the atlas               |
| `pnpm assets:check`  | Fail if the committed atlas is stale or hand-edited |
| `pnpm verify:tdd`    | Check the git history for honest RED→GREEN pairs    |
| `pnpm verify`        | Everything the pre-push hook runs                   |
| `pnpm allure:report` | Merged Allure report (needs a JRE — see below)      |

## Assets

Pixel art is authored as typed data in `assets/`, not as binary files:

```ts
const pacmanRightOpen: SpriteSource = {
  name: 'pacman-right-open',
  palette: { _: null, Y: '#ffff00' },
  pixels: ['_____YYYYYY_____', '___YYYYYYYYYY___' /* …16 rows of 16 */],
};
```

`pnpm assets:build` compiles these into `public/assets/atlas.png` and `atlas.json`, both committed.
A sprite change therefore shows up in review as changed pixels rather than as an opaque blob, and
`pnpm assets:check` fails if the atlas and its sources ever disagree.

## Verifying the TDD claims

Every claim in the charter has a command. None of them require trusting the author:

```bash
# Every feature commit is preceded by a failing-test commit,
# and no test file changed in between.
pnpm verify:tdd

# Watch any single slice go red then green.
git checkout <RED_SHA> && pnpm test     # fails
git checkout <GREEN_SHA> && pnpm test   # passes
```

`git log --oneline` shows the cycle directly: each `[GREEN]` is preceded by its `[RED]`.

## Test reporting

Both test tiers write Allure results to `allure-results/`. Allure's report generator is a Java
application, so `pnpm allure:report` needs a JRE; without one it says so and points at
`brew install --cask temurin` rather than failing with a stack trace. CI publishes the merged report
from the same result files, so nothing is lost locally.

## License

Pac-Man is a trademark of Bandai Namco. This is a non-commercial reimplementation built as an
engineering exercise.
