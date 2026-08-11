# CI workflow — not yet active

`github-actions-ci.yml` is the complete CI pipeline for this repository. It is parked here rather
than at `.github/workflows/ci.yml` because neither credential available when it was written could
push a workflow file:

| Credential                                | Write access to this repo | `workflow` scope |
| ----------------------------------------- | ------------------------- | ---------------- |
| PAT in the global `url.insteadOf` rewrite | yes                       | **no**           |
| `gh` CLI token (`lepulent`)               | **no**                    | yes              |

GitHub refuses any push that creates or updates a file under `.github/workflows/` unless the token
carries the `workflow` scope, so the file would be rejected either way.

## Activating it

Fix whichever credential is easier, then:

```bash
git mv ci/github-actions-ci.yml .github/workflows/ci.yml
rmdir ci
git commit -m "ci: activate the GitHub Actions pipeline"
git push
```

Either of these unblocks it:

- **Give the existing PAT the `workflow` scope** — regenerate it at
  https://github.com/settings/tokens with `repo` + `workflow`, and replace it in `~/.gitconfig`.
  Worth doing anyway: that token currently sits in plaintext in a global config and leaks into the
  output of `git remote -v` in every repository on the machine.
- **Grant `lepulent` write access** to `futurator-repos/pacman-tdd`, so the `gh` token — which
  already has `workflow` scope — can push.

## One thing to expect on the first run

The committed visual baseline is `walking-skeleton-chromium-**darwin**.png`, generated on macOS.
Playwright suffixes snapshots by platform, and the `e2e` job runs on `ubuntu-latest`, so the first
CI run will fail with _"snapshot doesn't exist: walking-skeleton-chromium-linux.png"_. That is
expected, and not a fault in the pipeline.

Generate the Linux baseline once and commit it:

```bash
# in the CI run, or locally in a linux container
pnpm exec playwright test --update-snapshots
```

Both baselines then live side by side and each platform uses its own. Reviewing the Linux one by eye
before committing it matters just as much as it did for the macOS one — see the visual QA section of
`docs/TDD-CHARTER.md`.

## What the pipeline does

| Job      | Steps                                                                  |
| -------- | ---------------------------------------------------------------------- |
| `static` | typecheck, lint, format check, knip, `assets:check`, TDD history check |
| `unit`   | Vitest with coverage thresholds enforced (100% on `core/`)             |
| `e2e`    | Playwright smoke, rendering and visual tests in Chromium               |
| `report` | merges both Allure result sets and publishes to GitHub Pages           |

The `static` job checks out with `fetch-depth: 0`, because `verify-tdd-history.js` walks the entire
log — a shallow clone would silently check nothing and pass.
