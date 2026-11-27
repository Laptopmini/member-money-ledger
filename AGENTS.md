# Agent instructions (canonical)

This repo is a take-home exercise: a member-money ledger for self-employed members. The
task is in `PROMPT.md`; the vendor (Ledgerly) API is in `CONTRACT.md`. How it was built is
in `docs/` (start at `docs/README.md`).

## Hard rules
- **Never modify `vendor/`.** It stands in for a third-party service.
- If the user is on Windows, give commands in PowerShell syntax.
- Commits: Conventional Commits (`feat(api): …`, `fix(web): …`, `test(api): …`,
  `docs(decisions): …`, `chore(deps): …`, `ci: …`, `build: …`), one logical change each,
  enforced by commitlint. No AI co-author trailers.

## Layout
| Path | What |
|---|---|
| `api/` | Django + DRF + drf-spectacular. `config/` settings/urls; `ledger/` app (models, vendor client, sync, money rules, views) |
| `api/schema.yml` | Committed OpenAPI schema (`make schema`); CI fails on drift |
| `web/` | React + TypeScript + Vite, TanStack Query, plain CSS tokens. `src/api/schema.d.ts` is generated (`make types`) |
| `vendor/` | Ledgerly stand-in. **Read-only.** |
| `flags/flags.json` | flagd feature flags (OpenFeature) |
| `deploy/` | Caddy config for the `prod` compose profile |
| `docs/` | Process, ADRs, traps, AI log, security |

## Commands
`make help` lists everything. Main ones: `make up` (dev, hot reload: web :5173, api :8000,
vendor :8080), `make prod` (Caddy + gunicorn on :8081), `make test`, `make e2e`,
`make lint`, `make typecheck`, `make types`, `make reset-demo [SEED=1]`, `make verify`
(every gate). Django: `docker compose exec api python manage.py <cmd>`.

## Product rules (each has a test; details and status in `docs/traps.md`)
1. Refunds are not income: a credit in a spend category nets against that category.
   Income = credits categorized `income`. Uncategorized credits are counted separately and flagged.
2. Pending rows show a badge, are excluded from totals, and are reported as "+ $X pending".
   They can change amount and `posted_on` when they post (same id).
3. `category: null` = Uncategorized, a first-class bucket. Unknown categories from sync are
   accepted on read; writes are validated against our list (`api/ledger/categories.py`).
4. `posted_on` is the member's local date: a `YYYY-MM-DD` string end to end. Never
   `new Date("YYYY-MM-DD")` in JS. Month = first 7 chars. "Current month" uses browser local time.
5. Money is integer cents, signed from `direction` in one function only, formatted only at the
   edge (`Intl.NumberFormat`). Non-USD rows are excluded from totals and flagged.
6. Vendor pagination: always `limit=100`; stop on `null` or a repeated cursor; upsert by id. A
   row missing from one sync is only tombstoned after `GET /v1/transactions/{id}` returns 404.
7. Sync conflicts (ADR 0019, amends the original `>=` rule): on a full sync the vendor row wins
   whenever it differs, except rows written locally by a PUT after that sync run started. After
   a PUT, store the vendor's response row.
8. Recategorize is write-through: validate → PUT to Ledgerly → save returned row → return it.
   On vendor failure nothing changes locally; map errors (never leak vendor text). Vendor down →
   502 with a friendly message; last synced data stays readable.
9. Validate transaction ids with a strict ASCII regex before building vendor URLs.
10. The vendor validates nothing on POST: our create paths validate everything, and the sync
    validates inbound rows, quarantining malformed ones (`SyncRejection`, ADR 0020).
11. The vendor is in-memory: a restart resets it (and reuses ids). The vendor is the source of
    truth; E2E resets vendor state.
12. `transfer` is excluded from spend and income.
13. Concurrency: last write wins at the vendor; we send `expected_updated_at` and return 409 when stale.
14. Session idle timeout (15 min): only user-initiated requests (header `X-User-Activity: 1`)
    extend it; background refetches don't.
15. Summary ETag is keyed by a data version (not `synced_at`), with `Cache-Control: private`.
16. Tax periods follow the IRS (Jan–Mar, Apr–May, Jun–Aug, Sep–Dec), and deductions use
    per-category fractions (meals 50%).
17. No merchant or description text in logs.

## Gates
`make verify` = Ruff + Biome + tsc + mypy + pytest + Vitest + schema/types drift. Pre-commit
and pre-push hooks (lefthook) run subsets. Playwright + Lighthouse run in CI.
