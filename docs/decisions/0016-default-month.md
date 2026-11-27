# 0016. Default month

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided at T0 in the build session; the owner picked the recommended option.)
- **Deciders**: Owner (choice), Claude (options)

## Context
Today is 2026-11-27 but the seed data is October 2026, so the default view would be empty (trap 21).

## Options
- **Current month with a jump link (chosen)**: predictable; may start empty
- **Latest month with data**: never empty; surprising and not today
- **Current month only**: simple; dead-end empty state

## Decision
Current month in browser local time; an empty month shows "jump to <latest month with data>". Demo seed fills November (ADR 0017).

## Consequences
Date handling stays string-based (trap 4). E2E covers the empty state.
