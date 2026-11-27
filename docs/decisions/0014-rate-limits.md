# 0014. Rate limits

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided at T0 in the build session; the owner picked the recommended option.)
- **Deciders**: Owner (choice), Claude (options)

## Context
Throttling protects the vendor, the sync and the login from scripts and brute force.

## Options
- **Tiered limits (chosen)**: each class gets a fitting limit
- **Strict everywhere**: simple; breaks normal UI use
- **Login only**: least friction; leaves writes and sync unbounded

## Decision
Reads 300/min, writes 30/min, `POST /api/sync` 6/min, login 5/min per IP plus 20/h per username.

## Consequences
429 responses use the standard error envelope. Per-IP limits behind a proxy depend on trusted forwarded headers.
