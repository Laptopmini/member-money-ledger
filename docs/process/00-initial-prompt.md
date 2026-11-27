# Initial prompt

> Executed verbatim as the first message of the build session, from the root of the
> fresh `member-money-ledger` repo. How this prompt was written, and the decisions taken,
> are in [`01-prompt-formulation.md`](01-prompt-formulation.md).

---

You are the **tech lead and orchestrator** of this take-home. I am the **owner**. You plan,
sequence, delegate to specialist subagents, review their work, commit, and report back to me.
You only write code yourself when delegating would be slower. You ask me before any decision
that is mine to make.

## 0. First actions (before anything else)

1. Run `date -u +%FT%TZ` and record it as **T0** in `docs/process/03-execution-log.md`.
   The time box is **T0 + 90 min**. The git log is the reviewer's timeline, so commit often.
2. If the repo has no commits yet: commit the untouched starter **excluding `docs/`** as
   `chore: import Collective starter`, then commit `docs/` as
   `docs(process): add initial prompt and prompt formulation record`.
3. Read, in this order: `PROMPT.md`, `CONTRACT.md`, `README.md`, `AGENTS.md`,
   `docker-compose.yml`, every file in `api/` and `web/`, and `vendor/server.py` +
   `vendor/seed.json` (read-only: **never edit `vendor/`**). Then read
   `docs/process/01-prompt-formulation.md`. Its decisions are **already settled**: don't
   re-ask them, implement them.

## 1. How we work

- **Talk to me with the AskUserQuestion tool** for every open decision, in batches of up to
  4, each with 2–4 options, pros and cons, and your recommendation first marked
  "(Recommended)". Debate; don't just ask. If I answer with a comment instead of an
  option, follow the comment.
- **Plan first, then execute.** Produce `docs/process/02-plan.md` (staged, with checkboxes)
  and walk me through it. Don't start Stage 2 until I approve it. Use plan mode if it helps.
- **Report back** at each stage boundary: what landed, the commit hashes, the time used versus
  plan, what's next, and any decision you need from me.
- **Orchestrate in parallel.** Run independent subagents in the same turn. Ownership
  boundaries prevent collisions: `backend-engineer` owns `api/`, `frontend-engineer` owns
  `web/`, `devops` owns root config/CI/compose/flags, `qa-engineer` owns test files it
  creates, `reviewer` is read-only. When two agents need the same file, sequence them.
- **Subagents never commit.** You review their diff, run the gates, and commit in small,
  scoped **Conventional Commits** (`feat(api): …`, `fix(web): …`, `test(api): …`,
  `docs(decisions): …`, `chore(deps): …`, `ci: …`, `build: …`). One logical change per commit.
- **Never push, change the remote, or make the repo public.** I do those.

## 2. Priorities and the clock

We use the whole 90 minutes and keep going while we're inside it. The tiers set the
**order**, not a stopping point:

| Tier | Scope |
|---|---|
| **Must** | PROMPT #1–#3 correct against every trap below; `GET /api/transactions`, `GET /api/summary`; money-math + sync unit tests; Playwright happy path; `NOTES.md`; README quick start |
| **Should** | #4 tax set-aside behind a flag; Claude Design handback applied (light/dark, mobile/desktop); auth with session login + idle timeout; rate limiting; audit log; hooks; CI; flagd; repo skills; full README |
| **Could** | Merchant rules; AI category suggestions (OpenAI-compatible endpoint); Lighthouse CI gate; demo data seeding; reconcile deletes; Cloudflare security audit |

- **At T+75 the feature freeze starts.** Only finish `NOTES.md`, the README, the docs, and a
  final green gate run. Anything unfinished goes to the README "Stretch goals / TODO" list.
- Check the clock at every stage boundary and log it in `03-execution-log.md`
  (`date -u` timestamp, stage, what landed, notes).

## 3. Product rules (traps already found; each needs a test)

The data is small but deliberate. Each rule gets an ADR or a line in `docs/traps.md`, plus a
test:

1. **Refunds are not income.** A credit in a spend category (seed `txn_000005`, Figma
   refund) nets against that category's spend. Income = credits categorized `income`.
   Uncategorized credits are counted separately and flagged, never silently treated as income.
2. **Pending** (`txn_000004`) may change amount *and* `posted_on` when it posts (same id).
   Show it with a badge, exclude it from totals, and show "+ $X pending" next to them.
3. **`category: null`** is "Uncategorized": a first-class bucket in filters and the summary,
   and a nudge ("3 transactions need a category"). Categories outside our list that arrive by
   sync are accepted on read. Only writes are validated against our list.
4. **`posted_on` is the member's local date.** Keep it a plain `YYYY-MM-DD` string end to
   end. Never `new Date("YYYY-MM-DD")` in JS (that's UTC midnight, the previous day in US
   time zones). Month = first 7 chars, and filters compare strings or `DateField`s. The
   "current month" default is computed in the browser's local time.
5. **Money is integer cents** end to end, signed from `direction` in one place only, and
   formatted only at the edge (`Intl.NumberFormat`). Currency is "expect USD": exclude
   non-USD rows from totals and flag them rather than adding them.
6. **Vendor pagination** is an offset cursor in disguise. Always send `limit=100`, stop on
   `null` **or a repeated cursor** (`limit=0`/negative values loop forever), and upsert by
   id, which makes duplicates harmless. A row missing from one sync is not deleted.
   Confirm with `GET /v1/transactions/{id}` returning 404.
7. **`updated_at` has one-second resolution**: upsert when `vendor.updated_at >= local`,
   and after a PUT store the vendor's response row.
8. **Recategorize is write-through**: validate the category → `PUT` to Ledgerly → save the
   returned row locally → return it. On vendor failure, nothing changes locally and the
   client gets a mapped error. Never leak raw vendor errors. Vendor down → 502 with a
   friendly message, and the last synced data stays readable.
9. **Path injection**: validate transaction ids against a strict regex before building
   vendor URLs.
10. **The vendor validates nothing on POST**: any create path we add validates everything
    itself.
11. **The vendor data lives in memory.** A vendor restart resets it while our Postgres
    mirror keeps the old rows. The vendor is the source of truth, and the sync handles it.
    E2E tests reset vendor state.
12. **Transfers** between the member's own accounts (`acc_checking` pays `acc_card`) would
    double-count. Add a `transfer` category that is excluded from spend and income.
13. **Concurrency**: the vendor has no ETag, so two tabs editing at once means last write
    wins. Detect a stale client with `updated_at` where we can, and document what remains.

**Keep hunting.** These are the traps found so far, not all of them. The `reviewer` agent
hunts for new ones at every stage. Each new trap goes in `docs/traps.md` (what, where,
how handled, which test) and, if an AI got it wrong, in `docs/ai-log.md`.

## 4. Settled architecture (see `01-prompt-formulation.md` for the options weighed)

- **D1 Mirror + write-through, worker + fallback.** One `sync()` service, called from a
  `sync_worker` compose service (same API image, `manage.py sync_ledgerly --loop`, ~30 s),
  from a request-path staleness check (>60 s, guarded by a Postgres advisory lock against
  stampedes), and from a Refresh button (`POST /api/sync`). Indexes on `posted_on`,
  `category`, `status`. Summaries are computed with SQL aggregates.
- **D2 DRF + drf-spectacular.** The OpenAPI schema is committed and turned into TypeScript
  types with `openapi-typescript`. CI fails if the schema or types drift.
- **D3 Latest stable everything**, looked up live at T0 (don't trust memory): Python,
  Django, DRF, Node, React, Vite, TypeScript. One `chore(deps)` commit before feature work.
- **D4 TanStack Query** with filters in the URL through a small hook. Recategorize is
  optimistic with rollback and a toast, and it invalidates transactions, summary and set-aside.
- **D5 Plain CSS + custom-property tokens**, light/dark through `prefers-color-scheme` plus
  a persisted toggle, mobile-first, no chart library (CSS bars), WCAG 2.2 AA.
- **D6 Ruff + Biome**, `tsc --noEmit`, mypy + django-stubs.
- **D7 lefthook**: pre-commit = Ruff, Biome, tsc on staged files; commit-msg = commitlint
  (conventional); pre-push = pytest, Vitest, mypy, `pip-audit`, `npm audit --omit=dev`.
  Playwright and Lighthouse run in GitHub Actions CI (`.github/workflows/ci.yml`).
- **D8 OpenFeature + flagd** container with `flags/flags.json`. Python: the OpenFeature SDK
  plus the flagd provider. Web: the OpenFeature React SDK plus the OFREP provider, proxied
  through `/flags`. Code defaults apply when flagd is unreachable. Flags: `tax-set-aside`,
  `merchant-rules`, `category-suggestions`, `auth-required`. A LaunchDarkly migration is a
  provider swap, and an ADR says so.
- **D9 Auth**: one seeded member, Django session login, idle timeout
  (`SESSION_SAVE_EVERY_REQUEST` and a short `SESSION_COOKIE_AGE`, with a "you'll be signed
  out soon" warning in the UI), CSRF on unsafe methods, login throttling, `HttpOnly` /
  `SameSite=Lax` / `Secure` cookies in prod. Single-tenant, but every query goes through a
  member scope so multi-tenant is an extension, not a rewrite.
- **D10 Tests**:
  - pytest-django for the money math (refund nets, pending excluded, uncategorized bucket,
    1st/last day of the month, transfers, non-USD), the sync (duplicate and skipped rows,
    a repeated cursor, a vendor restart, a pending row posting) and the vendor client
    (against a fake)
  - Vitest + Testing Library for formatting, the date helpers and components
  - Playwright + `@axe-core/playwright` against the prod build (filter, recategorize →
    summary changes, set-aside reacts, vendor-down state, login/timeout, mobile viewport)
  - Lighthouse CI with assertions ≥ 0.95 on performance, accessibility, best practices
    and SEO
- **Serving**: `docker compose up` is the hot-reload dev setup. `docker compose --profile
  prod up` runs the built web app behind Caddy (static files, `/api` + `/flags` proxy,
  security headers + CSP) and gunicorn. E2E and Lighthouse use prod. Everything must run
  **offline** once the images are built, with nothing fetched at runtime.
- **Security baseline**: DRF throttling (stricter on writes and login), an append-only
  `AuditEvent` (actor, action, transaction id, before/after, request id, ip, timestamp)
  shown as a per-transaction history, security headers + CSP, secrets and `DEBUG` from the
  environment (with a `.env.example`), strict serializers, vendor calls with timeouts and a
  bounded retry, no merchant or description text in logs, request-id middleware.

## 5. API (starting point; finalize in the plan)

Required: `GET /api/transactions` (filters `category` (incl. `uncategorized`), `from`, `to`,
`status`, `account`, `q`, plus `cursor`/`limit` → `{results, next_cursor, synced_at}`) and
`GET /api/summary?month=YYYY-MM` (`income_cents`, `spend_cents`, `net_cents`, `pending_cents`,
`uncategorized_count`, `by_category[]`, `synced_at`; 400 on a bad month). Likely more:
`GET/PATCH /api/transactions/{id}`, `GET /api/transactions/{id}/history`,
`GET /api/categories`, `POST /api/sync` + `GET /api/sync/status`, `GET /api/health`,
`/api/auth/{login,logout,me,csrf}`, `GET /api/tax/set-aside?quarter=`,
`PUT /api/tax/settings`, `POST /api/tax/set-aside-marks`, `/api/schema` (+ Swagger UI in
dev only). Could: `/api/rules`, `/api/transactions/{id}/suggestion`. Errors use one envelope
everywhere.

## 6. Idea #4: tax set-aside with a reason to categorize

Self-employed members have no withholding, so they under-save for quarterly estimated
taxes. The set-aside is **estimated from profit** (income − categorized business expenses)
× a member-editable rate (default from an open question to me), per quarter, with the next
federal due date. **The incentive** is that categorizing expenses visibly lowers the
estimate: "Categorize 3 transactions. Your estimate could drop by about $X." Also: an
"On track / $X behind" status, a progress bar toward the quarter's target, and a "Mark as
set aside" action (that's our success event). Labelled as an estimate, not tax advice. No
streaks or badges. `NOTES.md` covers why this problem, why it matters, and how we'd know it
worked (the metrics and events we'd instrument).

## 7. AI (Could tier, behind `category-suggestions`)

Merchant rules come first because they're deterministic. The LLM only suggests a category
for **unseen** merchants. It is **provider-agnostic**: any OpenAI-compatible
`/v1/chat/completions` endpoint, configured with `LLM_BASE_URL`, `LLM_MODEL` and
`LLM_API_KEY` (optional), using a JSON-schema response constrained to our category list,
with results cached per merchant. It is a suggestion only, never auto-applied. With nothing
configured, the feature is off and invisible. The local demo uses LM Studio
(`http://host.docker.internal:1234/v1`, `google/gemma-4-26b-a4b`). Include a small eval set
(seed merchants → expected category) with a script that reports accuracy and latency.
Member corrections are the future eval set. If time runs out, the ADR and the TODO entry
are enough.

## 8. Subagents (`.claude/agents/*.md`, created in Stage 1)

| Agent | Model | Owns |
|---|---|---|
| `backend-engineer` | sonnet | `api/`: models, sync, vendor client, views, money rules |
| `frontend-engineer` | sonnet | `web/`: components, data layer, applying `design/` |
| `qa-engineer` | sonnet | pytest edge cases, Vitest, Playwright + axe, Lighthouse CI |
| `reviewer` | opus | Read-only adversarial review: correctness, traps, security, a11y. Reports findings and never edits |
| `devops` | haiku | lefthook, commitlint, CI, compose profiles, Caddy, flagd, `.env.example` |

Each definition states: its scope and files owned, the rules in §3 that apply to it, "never
edit `vendor/`", "never commit", the gates to run before reporting, and the report format
(files changed, tests added, open questions, AI mistakes noticed). Give each the narrowest
tool set that works. Run `reviewer` on every stage's diff before you commit it.

## 9. Claude Design handoff (Stage 1, in parallel with scaffolding)

The owner runs one Claude Design session in the browser while the build continues. Produce
`docs/design/handoff/` with:

- `PROMPT-claude-design.md`: the prompt the owner pastes, ready to copy.
- **At most 10 attachments** in total, listed in the prompt in upload order. Suggested:
  `PROMPT.md`, `CONTRACT.md`, `vendor/seed.json`, `design-brief.md`, `api-examples.json`
  (real response shapes, including errors), `categories.md`, `states.md`, and
  `flags-and-roadmap.md`.
- **The brief covers every feature, current and future**, so the one design session counts:
  - the transactions list and filters, the monthly summary, recategorize (optimistic,
    error toast) and the uncategorized nudge
  - the pending badge, refund label and transfer label
  - vendor-down / stale-data banners, sync status and the Refresh button
  - login and the session-timeout warning, and the per-transaction audit history
  - the tax set-aside card with the categorize incentive, the progress bar and
    "Mark as set aside"
  - the merchant-rule prompt ("Apply to 4 other Figma transactions?") and AI suggestion
    chips
  - empty, loading and error states for each
- **Requirements given to Claude Design:** light and dark themes, mobile (375 px) and desktop
  (1280 px) layouts, WCAG 2.2 AA contrast and focus states, a system font stack or at most
  one self-hosted variable font (performance), no external assets at runtime, smooth
  transitions and animations.
- **The prompt tells Claude Design to produce a "handback" zip** with this layout: `README.md`
  (what's in it and how to apply it), `tokens.css` (light/dark custom properties),
  `components.md` (each component's anatomy, states and a11y notes), `screens/*.html`
  (static mockups per screen at both sizes, using only `tokens.css`), and any SVG icons. The
  owner unzips it into `design/` at the repo root and tells you. Until then,
  `frontend-engineer` builds the structure and behaviour on placeholder tokens. Applying
  the handback is its own stage.

## 10. Developer experience, performance, LLM-friendliness

- **One command per job** through a root `Makefile` (or `package.json` scripts): `make up`,
  `make prod`, `make test`, `make e2e`, `make lint`, `make types` (schema → TS), `make
  reset-demo`, `make verify` (every gate).
- **Repo skills** (`.claude/skills/`), at most 3: `verify` (run every gate, summarize the
  failures), `reset-demo` (restart the vendor, clear the mirror, sync, optionally seed demo
  data through the vendor's public POST), `adr` (new decision record from the template).
- **`AGENTS.md` is canonical** (layout, commands, rules from §3, never edit `vendor/`, the
  commit conventions). `CLAUDE.md` contains `@AGENTS.md` plus Claude-specific notes
  (agents, skills, the clock).
- **Backend performance**: SQL aggregates (one grouped query per summary), indexes, sync
  off the hot path, persistent DB connections or a pool, GZip, `Cache-Control`/ETag on
  summary keyed by `synced_at`, `select_related` wherever relations exist.
- **Frontend performance**: the prod build, route-level code splitting if there's more than
  one view, prefetching the adjacent month, no chart or UI library, a system font stack,
  `content-visibility` / virtualization noted for large lists.

## 11. Documentation (all markdown goes under `docs/`, except `README.md`, `NOTES.md`, `AGENTS.md`, `CLAUDE.md`)

```
docs/
  README.md                 index: what's where, and how to read the repo's history
  process/
    00-initial-prompt.md    this prompt (verbatim)
    01-prompt-formulation.md  how the prompt was written; the traps and decisions found at beginning
    02-plan.md              staged plan with checkboxes, ticked as we go
    03-execution-log.md     timestamped stage log (T0, each stage, the freeze, the end)
    roles.md                owner / main session / subagents / Claude Design: who did what, and how
  decisions/
    0000-template.md
    NNNN-<slug>.md          one ADR per decision: context, options with pros/cons, decision, consequences, who decided
  design/handoff/           what we sent to Claude Design
  traps.md                  trap register (found at beginning, and found during the build)
  ai-log.md                 where AI helped and where it was wrong, appended live with specifics
  security.md               threat model, controls in place, known gaps
```

Write ADRs D1–D10 from `01-prompt-formulation.md` in Stage 1. Add one for every new
decision we make together. `docs/ai-log.md` is appended **as things happen**, by you and
from the subagents' reports, never reconstructed at the end.

## 12. Deliverables at the end

- **`README.md`**, 0-to-hero:
  - a quick start at the top (prerequisites, `make up`, open the URL, demo login)
  - architecture as a Mermaid flowchart (web → Caddy → API → Postgres; sync worker ↔
    Ledgerly; flagd; optional LLM)
  - an API overview table of every endpoint
  - testing: unit, E2E, Lighthouse, and how to run each
  - feature flags and how to toggle them
  - known limitations and security risks not addressed
  - stretch goals / TODO, including running Cloudflare's security-audit skill
    (`npx skills add https://github.com/cloudflare/security-audit-skill --skill
    security-audit`)
  - links into `docs/`
- **`NOTES.md`** (required by `PROMPT.md`):
  - what we built and the decisions made
  - idea #4: the problem, why it matters, how we'd know it worked
  - where AI helped and where it was wrong (from `docs/ai-log.md`, with specifics)
  - what we'd do with another day
  - the **real time spent**, from the execution log
- Gates green, the working tree clean, and a final `docs(process): close execution log`
  commit. Tell me the zip command (excluding `node_modules`, keeping `.git`) and stop.

## 13. Your first deliverable to me

After reading (§0), come back with:

1. A short readback: the task, the required endpoints, and anything in the starter or vendor
   that contradicts or adds to §3. **New traps go first.**
2. **The open decisions**, asked through AskUserQuestion. At least:
   - the category list (and whether to align it with Schedule C)
   - the set-aside default rate and how due dates are shown
   - the session idle timeout length
   - the rate limits
   - the transactions pagination shape
   - the default month
   - demo data seeding (yes/no, and how many months)
   - merchant-rule scope
   - anything new you found
3. Then `docs/process/02-plan.md`: the stages, which agent does what in each, what runs in
   parallel, the commit points, the time budget per stage against T0, and the cut line.
   Walk me through it and wait for my go.
