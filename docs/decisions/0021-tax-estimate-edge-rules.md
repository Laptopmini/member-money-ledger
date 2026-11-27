# 0021. Tax estimate edge rules: cross-period refunds, incentive, member date, grace window

- **Status**: Accepted (refines 0012)
- **Date**: 2026-11-27 (T+45, after the Stage 4 backend review)
- **Deciders**: Owner (choice), Claude (options; reviewer agent found the cases)

## Context
The reviewer found four places where the set-aside estimate could mislead a member
(`api/ledger/tax.py`, `tax_views.py`):
1. A refund in this IRS period for a charge from an earlier period (e.g. a $1,000 software
   refund in Q4, charged in Q3 and already deducted then) makes the category net negative.
   Clamping each category at 0 dropped it, under-estimating by refund × rate.
2. The incentive ("your estimate could drop by about $X") counted pending debits, assumed
   100 % deductibility, and was uncapped: it could promise more than the estimate.
3. "Today" came from the server's UTC clock, but `posted_on` is the member's local date: at
   7 pm US Eastern on Dec 31 the card already showed next year's Q1.
4. From Jan 1–15, Jun 1–15 and Sep 1–15 the previous period's payment is still due within days,
   but the card showed the new period.

## Options
1. Net across categories (clamp only the total) vs. clamp per category.
2. Posted-only and capped at the estimate vs. keep it broad and reword.
3. The browser sends its local date vs. a `MEMBER_TZ` setting.
4. Earliest period whose due date hasn't passed vs. the current period plus a "due soon" banner.

## Decision
1. **Net across categories**, clamping only total deductions and profit at 0. The owner added a
   requirement: explain it so the member isn't surprised. The API returns
   `refund_adjustment_cents` and the card shows an info pill ("Includes a $X refund for an
   earlier purchase, which raises this quarter's profit").
2. **Posted only, capped**: `min(estimate, posted uncategorized debits × rate)`, worded "up to
   about $X". Pending uncategorized rows are counted separately.
3. **The browser sends `today`** (same rule as the "current month", AGENTS.md rule 4), validated
   within ±1 day of the server's UTC date.
4. **Earliest unpaid due**: the default period is the earliest one whose due date is today or
   later. `is_current_period` lets the UI say "due in 5 days" versus "current period".

## Consequences
- An estimate can go **up** after a refund; the pill explains why.
- The incentive number is smaller but never over-promises.
- API clients other than the web app must send `today` to get member-local behaviour.
- For two weeks after each period ends, the card shows the period whose payment is still due.
