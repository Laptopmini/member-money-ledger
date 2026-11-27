---
name: verify
description: Run every quality gate for member-money-ledger (lint, types, unit tests, schema/types drift, optionally E2E) and summarize failures. Use before committing, before a PR, or when asked "is it green?".
---

# Verify

1. Make sure the dev stack is up: `docker compose ps`. If `api` or `web` aren't running, `make up` (detached: `docker compose up -d --build`).
2. Run `make verify` from the repo root. It runs Ruff, Biome, mypy, tsc, pytest, Vitest and the
   `api/schema.yml` / `web/src/api/schema.d.ts` drift check.
3. If asked for the full pyramid, also run `make e2e` (Playwright + axe against the prod profile on
   :8081; it restarts the vendor, so demo data is lost).
4. Report as a short table: gate → pass/fail → first failing test or file:line. Paste failing
   output verbatim (trim to the relevant lines). Don't fix anything unless asked.

Notes: an expected `xfail` (same-second vendor `updated_at`, trap 32) is not a failure.
Schema drift means someone changed views/serializers without `make types`.
