# Build plan

T0 = 2026-11-27T18:16:53Z. Box ends T+90 (19:46:53Z). Freeze at T+75 (19:31:53Z).
Tiers set order, not a stopping point. Each stage ends with: `reviewer` on the diff → gates →
scoped Conventional Commits → execution-log row → report to owner.

## Decisions taken in this session (become ADRs 0011–0020)

| # | Decision | Choice |
|---|---|---|
| D11 | Categories | Schedule C-mapped list of 16: `income, transfer, personal, software, meals, travel, office, advertising, contractors, professional_services, insurance, utilities, rent, equipment, fees, other`. Each has a label, Schedule C line, `deductible_fraction` (meals 0.5, personal/transfer/income 0). Unknown synced categories accepted on read. |
| D12 | Tax set-aside | 25 % of estimated profit, member-editable. IRS periods (Jan–Mar→Apr 15, Apr–May→Jun 15, Jun–Aug→Sep 15, Sep–Dec→Jan 15). Deductions use per-category fractions. |
| D13 | Session | 15 min idle timeout; warning 2 min before; background polls/refetches do **not** extend the session (only requests flagged as user activity do). |
| D14 | Rate limits | Reads 300/min, writes 30/min, `POST /api/sync` 6/min, login 5/min/IP + 20/h/username. |
| D15 | Pagination | Keyset cursor over `(posted_on desc, id desc)`, limit default 50, max 200. |
| D16 | Default month | Current month in browser local time; empty month → "jump to <latest month with data>". |
| D17 | Demo data | `make reset-demo` seeds ~60 rows Sep–Nov 2026 via the vendor's POST (validated by us first). |
| D18 | Merchant rules | Exact normalized merchant, both directions; applies to that merchant's uncategorized rows now and future uncategorized synced rows; never overwrites explicit choices. |
| D19 | Sync conflict | **Amends rule #7**: vendor wins on every full sync when the row differs, except rows written locally by a PUT after this sync run started. |
| D20 | Bad vendor rows | Quarantine in `SyncRejection` (id, reason, payload), excluded from list/totals, count shown in sync status; sync continues. |

## Stages

### Stage 0: Read, decide, plan (T+0 → T+10) ✅
- [x] T0 recorded; starter + docs committed (`e1351f5`, `18fe259`)
- [x] Readback with new traps; decisions batch 1–3
- [ ] Owner approves this plan

### Stage 1: Foundations (T+10 → T+22), all in parallel
| Who | Work | Commit |
|---|---|---|
| main | `.claude/agents/*.md` (5 agents), `AGENTS.md` canonical + `CLAUDE.md` → `@AGENTS.md` | `chore: add subagent definitions and agent docs` |
| main | `docs/` skeleton: README index, `traps.md` (all known + 14 new), `ai-log.md`, `security.md`, `roles.md`, ADR template + 0001–0020 (short) | `docs(decisions): …`, `docs: add trap register…` |
| main | `docs/design/handoff/` (prompt + ≤10 attachments) → **owner starts Claude Design** | `docs(design): add Claude Design handoff` |
| devops | Look up latest stable versions live (Python, Django, DRF, drf-spectacular, psycopg, Node, React, Vite, TS, TanStack Query, Biome, Ruff, Vitest, Playwright); bump Dockerfiles + manifests; fix the `node_modules` anon-volume trap | `chore(deps): upgrade to latest stable` |
| devops | Root `Makefile`, `lefthook.yml`, commitlint, `.env.example`, compose: `sync_worker`, `flagd` + `flags/flags.json`, `prod` profile stub (Caddy + gunicorn) | `build: …`, `chore: add lefthook…` |

### Stage 2: Must core (T+22 → T+50), backend ‖ frontend ‖ qa
| Who | Work |
|---|---|
| backend | `ledger` app: settings from env; models `Transaction` (indexes posted_on/category/status, `local_write_at`), `SyncRun`, `SyncRejection`; vendor client (timeouts, bounded retry, id regex, error mapping, non-JSON tolerant); `sync()` (limit=100, stop on null/repeat cursor, upsert vendor-wins + race guard, ingest validation → quarantine, missing rows confirmed by 404 → tombstone); advisory lock (`pg_try_advisory_lock`, skip if held); `sync_ledgerly --loop`; endpoints `GET /api/transactions`, `GET/PATCH /api/transactions/{id}`, `GET /api/summary`, `GET /api/categories`, `POST /api/sync`, `GET /api/sync/status`, `GET /api/health`; one error envelope; SQL-aggregate summary (refund nets, pending excluded + `pending_cents`, uncategorized bucket + credits flagged, transfers excluded, non-USD excluded + flagged); ETag keyed by data version, `Cache-Control: private`; drf-spectacular schema committed |
| qa | Fake vendor fixture + pytest: money math (refund, pending, uncategorized, 1st/last day, transfer, non-USD, negative category), sync (dup/skip, repeated cursor, limit-0 guard, restart convergence, pending posts with new date, bad rows quarantined, race guard), vendor client (timeout, non-JSON, 5xx retry, id regex) |
| frontend | Vite/React structure on placeholder tokens: TanStack Query, `useUrlFilters`, date helpers (string-only, local "current month"), `formatCents` (Intl), Transactions list (pending badge, refund/transfer labels, uncategorized nudge), filters (category incl. uncategorized, from/to), Summary (CSS bars, "+ $X pending", empty → jump to latest month), recategorize optimistic + rollback toast, vendor-down/stale banner, Refresh; Vitest for helpers + key components |
| main | `make types` (openapi-typescript), wire types into web once schema lands; review, gates |

Commits: `feat(api): models and vendor client`, `feat(api): sync service and worker`,
`feat(api): transactions and summary endpoints`, `test(api): …`, `feat(web): …`, `test(web): …`.

### Stage 3: Must close (T+50 → T+58)
- [ ] qa: Playwright + axe happy path (filter → recategorize → summary changes; vendor-down banner; mobile viewport), vendor reset between runs
- [ ] reviewer: full adversarial pass on the Must diff; fixes
- [ ] main: README quick start, `NOTES.md` first draft
- Commits: `test(e2e): …`, `fix(...)`, `docs: …`

### Stage 4: Should (T+58 → T+75), parallel by owner of files
| Who | Work |
|---|---|
| backend | Tax set-aside (`GET /api/tax/set-aside?quarter=`, `PUT /api/tax/settings`, `POST /api/tax/set-aside-marks`) behind `tax-set-aside`; auth (session login, idle-timeout middleware honoring user-activity header, CSRF, login throttle, member scope); throttles; `AuditEvent` + `GET /api/transactions/{id}/history`; OpenFeature + flagd provider |
| frontend | Set-aside card (incentive line, progress bar, On track/$X behind, Mark as set aside), login + timeout warning, history drawer, OpenFeature React + OFREP; **apply the design handback if it has arrived** |
| devops | `.github/workflows/ci.yml` (lint, types drift, pytest, Vitest, Playwright, Lighthouse), Caddy prod profile + CSP |
| qa | Tests for set-aside math (IRS periods, meals 50 %), auth/timeout, throttle, audit |

### Freeze (T+75 → T+90)
- [ ] `NOTES.md` final (incl. real time from this log), README full (Mermaid, API table, flags, limits, TODO), docs index
- [ ] `make verify` green, tree clean, `docs(process): close execution log`, zip command

## Cut line
If Stage 2 runs past T+55, Stage 4 shrinks to **tax set-aside + auth** only; the rest goes to
README "Stretch goals / TODO". Could tier (rules, AI suggestions, Lighthouse gate, reconcile
deletes, Cloudflare audit) is TODO unless Stage 4 finishes early. Design handback applies
only if received by T+65.
