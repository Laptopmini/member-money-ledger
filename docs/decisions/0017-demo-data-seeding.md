# 0017. Demo data seeding

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided at T0 in the build session; the owner picked the recommended option.)
- **Deciders**: Owner (choice), Claude (options)

## Context
The vendor's seed is small and old; demos and E2E need realistic, current data.

## Options
- **3 months, ~60 rows via vendor POST, validated first (chosen)**: enough to show every case; seeding is quick
- **12 months**: richer charts; slower and bigger to maintain
- **None**: no setup; empty demo

## Decision
`make reset-demo` seeds ~60 rows for Sep-Nov 2026 through the vendor's POST. Rows are validated by us first because the vendor validates nothing (trap 10).

## Consequences
Vendor state is in memory: a restart loses seeded rows and reuses ids (trap 15), so reseed after restarts. Sync converges per ADR 0019.
