# 0004. TanStack Query with filters in the URL

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided in prompt formulation, before T0.)
- **Deciders**: Owner (choice), Claude (options)

## Context
A recategorize must show up everywhere (list, summary, set-aside) and filters should be shareable and survive reload.

## Options
- **TanStack Query + URL state hook**: cache, invalidation and optimistic updates with rollback; small custom hook for URL filters
- **TanStack Query + TanStack Router**: typed routes; heavier for a small app
- **Plain fetch**: no dependency; hand-rolled caching and invalidation, easy to get inconsistent

## Decision
TanStack Query with filters in the URL via a small `useUrlFilters` hook. Recategorize is optimistic with rollback and a toast, and invalidates transactions, summary and set-aside.

## Consequences
Consistent views after edits and shareable URLs. Dates stay strings (trap 4). Components need a query client in tests.
