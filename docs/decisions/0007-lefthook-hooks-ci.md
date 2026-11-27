# 0007. lefthook for git hooks; Playwright and Lighthouse in CI

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided in prompt formulation, before T0.)
- **Deciders**: Owner (choice), Claude (options)

## Context
Conventional Commits and quality gates must be enforced without slowing every commit.

## Options
- **lefthook**: single binary, parallel hooks, language-agnostic
- **husky + lint-staged**: familiar in JS; Node-only and slower for Python
- **pre-commit**: strong Python ecosystem; separate environments and less natural for JS

## Decision
lefthook. Pre-commit: Ruff, Biome, tsc on staged files. commit-msg: commitlint (conventional). Pre-push: pytest, Vitest, mypy, `pip-audit`, `npm audit --omit=dev`. Playwright and Lighthouse run in GitHub Actions (`.github/workflows/ci.yml`).

## Consequences
Fast local loop; slow checks happen in CI. Hooks can be skipped locally, so CI is the real gate.
