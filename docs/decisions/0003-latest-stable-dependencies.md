# 0003. Upgrade everything to latest stable, looked up live

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided in prompt formulation, before T0.)
- **Deciders**: Owner (choice), Claude (options)

## Context
The starter pins older versions; memory of current versions is unreliable.

## Options
- **Upgrade everything**: current security fixes and features; risk of breakage, paid up front in one commit
- **Keep the starter's versions**: no churn; carries known vulnerabilities and old tooling
- **Frontend only**: partial; leaves Django/Python behind

## Decision
Upgrade everything to latest stable, with versions looked up live at T0 (Python, Django, DRF, drf-spectacular, psycopg, Node, React, Vite, TS, TanStack Query, Biome, Ruff, Vitest, Playwright), in one `chore(deps)` commit before feature work.

## Consequences
Breakage surfaces early and is isolated in one commit. `pip-audit` and `npm audit` in pre-push stay meaningful. Versions are pinned in manifests and lockfiles.
