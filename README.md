# pacman-tdd

An arcade-accurate Pac-Man, built to game-studio codebase standards: strictly typed, test-driven,
with quality gates that fail the build rather than file a warning.

> **Status:** design approved, scaffold in progress. No gameplay yet.

## Design

The engineering design lives in
[`docs/superpowers/specs/2026-08-06-pacman-tdd-scaffold-design.md`](docs/superpowers/specs/2026-08-06-pacman-tdd-scaffold-design.md).
Read it first — it explains why the layers are drawn where they are.

## Architecture in one picture

```
app/         composition root
  ├── platform/    keyboard, audio, RAF, storage — the impure edge
  ├── render/      reads state → draws it, never mutates
  └── core/        pure, deterministic, dependency-free game rules
```

`core/` imports nothing outside itself, runs with no DOM available, and may not call `Date.now()` or
`Math.random()` — time and randomness are injected. That is what makes the rules directly testable
and makes bugs reproducible from a seed.

## Stack

| Concern | Tool |
|---|---|
| Build / dev server | Vite + TypeScript (strict, `any` banned) |
| Unit & component tests | Vitest |
| End-to-end tests | Playwright |
| Test reporting | Allure |
| Linting | ESLint 9 flat config, typescript-eslint strict-type-checked |
| Dead code & unused deps | Knip |
| Git hooks | Husky + lint-staged + commitlint |

## Commands

Filled in as the scaffold lands.

## License

Pac-Man is a trademark of Bandai Namco. This is a non-commercial reimplementation built as an
engineering exercise.
