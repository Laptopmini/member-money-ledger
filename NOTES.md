# Notes

## What I built

A ledger for a self-employed member, built as a small production service rather than a demo.

- **Transactions page**: every transaction, newest first, with keyset pagination. Filters are
  category (including *Uncategorized*), date range, status, account and search. They live in
  the URL, so a filtered view can be shared and survives a reload. Pending, refund, transfer
  and income rows carry labels, and the "N transactions need a category" nudge filters to them.
- **Monthly summary**: income, spend and net for a chosen month, with spend by category as
  CSS bars and "+ $X pending" next to spend. If the month is empty, it offers to jump to the
  latest month with data.
- **Recategorize**: picking a category updates the row, the summary and the tax card at once
  (optimistic). It is written through to Ledgerly, and the vendor's response row is what we
  store. On failure, only that row rolls back, with a specific message and a Retry button.
- **Idea #4, tax set-aside** (below).
- **Around it**:
  - Session login with a 15-minute idle timeout and a warning before it.
  - CSRF protection, rate limits and an append-only audit log, with history per transaction.
  - Feature flags (OpenFeature + flagd).
  - Light and dark themes, and mobile and desktop layouts.
  - CI covering lint, types, unit tests, E2E with axe, Lighthouse, and schema/type drift.
  - A `prod` compose profile (Caddy + gunicorn) that runs offline.

### Decisions that matter

ADRs 0001–0020 are in `docs/decisions/`. These are the ones I'd defend in the room:

1. **Mirror plus write-through, not a live proxy** (ADR 0001).
   - Why not a proxy: Ledgerly has no filters, no "changed since", and pagination that is an
     offset in disguise. A proxy would re-list everything on every page view and die when the
     vendor does.
   - What we do: Postgres mirrors the vendor. A worker syncs every 30 s, a request-path
     fallback syncs when data is older than 60 s (behind an advisory lock), and the member can
     press Refresh.
   - Writes go to the vendor first. Nothing changes locally unless the vendor accepted the
     write.
2. **The vendor wins every full sync, except a write we made during that sync** (ADR 0019).
   - The prompt I started from said "upsert when `vendor.updated_at >= local`".
   - That never converges after the in-memory vendor restarts, because the re-seeded rows are
     *older* than our edits.
   - Rule we use instead: the vendor is the source of truth, guarded only against a race with
     our own in-flight PUT.
3. **Malformed vendor rows are quarantined, not dropped and not coerced** (ADR 0020).
   - The vendor's POST validates nothing.
   - One row with a 300-character merchant or a NUL byte would have frozen the sync forever.
     The reviewer agent found this (trap 30).
4. **Money is integer cents, and the sign comes from `direction` in one function.**
   - A refund nets against its own category; it is never income.
   - Pending rows are excluded from totals and shown beside them.
   - Transfers between the member's own accounts are excluded from both spend and income.
   - Non-USD rows are excluded and flagged.
   - `posted_on` stays a string end to end. JS `new Date("2026-10-01")` is Sep 30 in the US.
5. **Schedule C–mapped categories** (ADR 0011), so the tax estimate can count meals at 50 %
   and personal spending at 0 %.

The full list of what the data and the vendor do to a naive implementation is `docs/traps.md`:
44 entries, each with how it's handled and the test that proves it.

## Idea #4: "Set aside for taxes"

**The problem.** A self-employed member has no withholding. Every dollar of profit owes
roughly 15.3 % self-employment tax plus income tax. It's due in four IRS estimated payments,
and the IRS periods aren't calendar quarters (Q2 is two months; Q4's payment is due Jan 15).
The money arrives as an $8,500 invoice that feels like income, gets spent, and turns into a
penalty plus a cash crunch in April. It's one of the most common and most expensive money
problems for this audience.

**What we built.** A card for the current IRS period:
- **The estimate and its basis:** an estimated amount to set aside (profit × an editable
  rate, 25 % by default), with the due date and days left.
- **Progress toward it:** a progress bar showing what's already set aside, and a calm status:
  *On track* or *$X behind*, never red.
- **The incentive:** profit is income minus *categorized* business expenses, so uncategorized
  spending doesn't lower the estimate. The card says so: *"Categorize 3 transactions. Your
  estimate could drop by about $78."* That line takes you to them.
- **Mark as set aside:** records the money the member moved. That's the success event.

The incentive ties idea #4 to the core feature: the member is rewarded for keeping the books
accurate, which is what makes every other number in the app trustworthy. No streaks, badges or
confetti. It's labelled as an estimate, not tax advice.

**Why it matters to Collective.** Collective's members pay for peace of mind about taxes. A
member who sees "you're on track for Q4" in the app gets that peace of mind, and is less
likely to churn after a bad April.

**How we'd know it worked.** The events we'd instrument:
- `set_aside_card_viewed`
- `set_aside_incentive_clicked`
- `transaction_recategorized` (with `source = incentive | list | rule`)
- `set_aside_marked` (amount, quarter, gap before and after)
- `tax_rate_changed`

The metrics built on them:
- **Primary: share of active members on track at each due date** (set aside ≥ estimate). Run it
  as a holdout: card on vs. off, behind the `tax-set-aside` flag.
- **Leading: uncategorized debits per member per period.** The incentive should push this down
  within a week of viewing.
- **Behaviour: Mark as set aside per member per period,** and time from income arriving to the
  first mark.
- **Guardrails:**
  - Estimate accuracy against the member's actual payment, where we can see it.
  - Support contacts that mention "estimate".
  - Rate edits to 0 %, a sign the estimate isn't trusted.

## Where AI helped, and where it was wrong

The whole build was AI-orchestrated: I (Claude, Opus) acted as tech lead with Sonnet engineers,
a Haiku devops agent and an Opus read-only reviewer. The owner made every product decision. The
live log with timestamps is `docs/ai-log.md`. The specifics:

**Helped**
- **Traps the plan had wrong.** At T0, reading `vendor/server.py` turned up 14 traps the prompt
  analysis had missed. The most important was that the settled sync rule (`>=`) contradicted
  "the vendor is the source of truth".
- **Code and tests in parallel.** QA wrote 121 tests against an agreed interface while the
  backend was still being written. One of them (`test_duplicate_rows_harmless`) caught a real
  sync bug: offset drift hides a row.
- **The reviewer agent earned its cost every round.** It found:
  - A sync-freezing blocker (oversize and NUL fields).
  - A race window that the race test didn't cover.
  - "+ $X pending" inflated by pending transfers.
  - An ETag that froze `synced_at`.
  - A CSRF-able `POST /api/sync`.
  - On the web: a false "changed in your bank feed" 409 on a second quick edit, and a rollback
    that wiped other rows' edits.
  - Contrast failures computed to two decimals.

**Wrong**
- **Optimistic update copied from a library example.** The frontend agent copied the TanStack
  optimistic-update example, which assumes one mutation at a time. Its tests passed because
  refetches repaired the cache. That's AI producing plausible code whose tests prove nothing.
- **Logic duplicated and drifted.** The frontend duplicated the backend's classification rule,
  and the copy had already drifted (a chargeback was shown as spend).
- **A test gap only E2E caught.** Every tax unit test ran with auth off, so none saw that
  `request.user` is a lazy object when signed in: "Mark as set aside" returned 500. The E2E
  agent found it by running the real flow.
- **APIs from memory.** The backend used `django.utils.timezone.utc`, removed in Django 6, and
  the 500 envelope hid it. The devops agent picked Python 3.15 without checking every
  dependency had a wheel for it, and a `biome migrate` silently disabled every lint rule.
- **A test that proved nothing.** QA's race test put the race in the one window the code
  already handled. Trap 15's fix was documented but never implemented. The reviewer caught
  both.
- **Shipped unseen.** The frontend agent shipped a 375 px layout without looking at it. It was
  416 px wide. A screenshot caught it.
- **My own commit mistakes.** I let failed commits' files leak into the next commit twice (a
  commitlint rejection hidden by my output filter), and had to soft-reset local commits.

## What I'd do with another day

- **Finish the design handback's structural pieces:** the transaction detail drawer with its
  audit history (the API exists), the container-query app shell, the account menu, and the
  mobile filter sheet. The tokens and visual layer are already applied.
- **Run the suggestion eval with the local model actually serving.** During the build, LM
  Studio timed out on every call, so the 0/15 we got measures availability, not accuracy.
  Member corrections would then become the next eval set.
- **Reconcile deletions visibly** ("this transaction disappeared from your bank feed").
- **Production fixes:**
  - Throttles in Redis instead of the database cache.
  - A real `Member` foreign key on transactions; queries already go through a member scope.
  - TLS in the prod profile.
  - Database-enforced append-only audit and set-aside marks.
- **Instrument the events above** and run the holdout.

## Time spent

From `docs/process/03-execution-log.md` (UTC; T0 = 18:16:53Z):

| Milestone | Time | T+ |
|---|---|---|
| Readback, 11 owner decisions, plan approved | 18:28 | 12 |
| Stage 1 foundations committed (docs, ADRs, deps, tooling) | 18:46 | 29 |
| Must tier: API + web + tests green, both reviews applied | 18:56 | 39 |
| Should tier: auth, idle timeout, flags, tax set-aside, CI | 19:09 | 52 |
| Could tier: merchant rules, AI suggestions; E2E 10/10 | 19:16 | 59 |
| Design handback applied | 19:16 | 60 |
| Freeze, docs and final gates | 19:17–19:31 | 60–75 |

The build ran from 18:16:53Z to the final commit, inside the 90-minute box. The owner's
own time was in the Claude Design session and in answering 15 decision questions, in 4
batches.
