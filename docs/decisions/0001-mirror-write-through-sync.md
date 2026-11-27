# 0001. Mirror vendor data in Postgres with write-through sync

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided in prompt formulation, before T0.)
- **Deciders**: Owner (choice), Claude (options)

## Context
The vendor API (`CONTRACT.md`) has no filters, no "changed since", in-memory state and an unlocked list (traps 6, 11, 17). Our API needs filtering, totals and a usable UI even when the vendor is slow or down.

## Options
- **Live proxy**: simple, no stored state; but O(n) vendor paging per request, no SQL aggregates, dead when the vendor is down
- **Postgres mirror + write-through**: fast filters and SQL summaries, survives vendor outages for reads; needs a sync service and conflict rules
- **Mirror + background worker only**: production shape; but a one-command demo or test would show stale or empty data until the worker runs

## Decision
Mirror with write-through: PATCH validates, PUTs to the vendor, then saves the returned row. One `sync()` service is called from a `sync_worker` compose service (~30 s), from a request-path staleness fallback (>60 s, guarded by a Postgres advisory lock) and from a Refresh button (`POST /api/sync`). Indexes on `posted_on`, `category`, `status`. Owner: "production ready but easy to demo locally".

## Consequences
Reads are fast and summaries are SQL aggregates. We own sync correctness (see ADR 0019, 0020; traps 6, 8, 11, 14, 15). Data can be briefly stale; the UI shows a stale/vendor-down banner and `synced_at`.
