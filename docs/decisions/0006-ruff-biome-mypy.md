# 0006. Ruff + Biome, tsc and mypy

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided in prompt formulation, before T0.)
- **Deciders**: Owner (choice), Claude (options)

## Context
We want fast, one-tool-per-language linting and formatting plus type checking, cheap enough for pre-commit.

## Options
- **Ruff + Biome + tsc + mypy/django-stubs**: fast, few configs, strong checks; Biome has fewer plugins than ESLint
- **Ruff + ESLint/Prettier**: largest plugin ecosystem; slower and more config
- **Without mypy**: less friction; money and sync code lose static checks

## Decision
Ruff (lint + format), Biome, `tsc --noEmit`, mypy with django-stubs.

## Consequences
Pre-commit stays quick. mypy on Django needs stubs and occasional ignores.
