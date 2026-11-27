# 0015. Keyset pagination

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided at T0 in the build session; the owner picked the recommended option.)
- **Deciders**: Owner (choice), Claude (options)

## Context
Offset paging duplicates or skips rows when data changes, and same-date ties exist (traps 6, 24).

## Options
- **Keyset cursor (chosen)**: stable under inserts; no jump to page N
- **Offset/page numbers**: familiar; unstable, slow on deep pages
- **No pagination**: simplest; unbounded payload

## Decision
Keyset cursor over `(posted_on desc, id desc)`, default limit 50, max 200.

## Consequences
Responses return `next_cursor`. Clients cannot jump to arbitrary pages. Tested by `test_cursor_stable_on_ties`.
