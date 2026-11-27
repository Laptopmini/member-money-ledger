# 0020. Quarantine malformed vendor rows

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided at T0 in the build session; the owner picked the recommended option.)
- **Deciders**: Owner (choice), Claude (options)

## Context
The vendor validates nothing on POST, so sync can receive float, negative or string amounts, bad directions or dates (trap 16).

## Options
- **Quarantine in `SyncRejection` (chosen)**: visible, recoverable, keeps sync going
- **Skip and log**: simple; silent data loss, logs must avoid PII
- **Coerce**: keeps rows; guesses at money values

## Decision
Store rejected rows in `SyncRejection` (id, reason, payload), exclude them from lists and totals, show the count in sync status, and continue the sync.

## Consequences
Totals may omit bad rows but never contain guessed values. Tested by `test_bad_rows_quarantined`.
