# Design brief: Collective Member Money ledger

## Who and why
Members are **self-employed business owners** (designers, consultants, contractors). They
connect bank accounts through a vendor (Ledgerly). This app helps them understand where
their money goes and **set aside enough for quarterly estimated taxes**. They are busy, not
accountants. The app should be usable with no explanation: calm, trustworthy, plain English,
numbers first.

## Platforms and hard requirements
- **Responsive web app.** Design at **375 px** (mobile) and **1280 px** (desktop).
- **Light and dark themes** from the same tokens, `prefers-color-scheme` + a manual toggle.
- **WCAG 2.2 AA**: text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI boundaries), visible
  focus rings (≥ 2 px, ≥ 3:1), targets ≥ 24×24 px (aim 44 px on mobile), never color alone
  to convey meaning (income/spend also use a sign or a word), reduced-motion support.
- **Performance**: system font stack (or at most one self-hosted variable font), no images
  except inline SVG icons, no external assets at runtime, no chart library (bars are CSS).
- **Motion**: smooth, short transitions (150–250 ms) for hover, toasts, optimistic updates,
  the progress bar filling, drawers/sheets opening. All disabled under
  `prefers-reduced-motion`.
- Money uses tabular figures, right-aligned in tables, always with a sign or label for
  direction. Currency USD, formatted `$1,234.56`.

## Information architecture
One app shell: header (app name, month picker, sync status + Refresh, theme toggle,
account menu with Sign out). Main content:

1. **Summary** for the chosen month (top on mobile, left/top on desktop).
2. **Tax set-aside card** (beside or below the summary).
3. **Transactions** list with filters.

A per-transaction **detail drawer** (desktop: side panel; mobile: bottom sheet) holds the
category picker, description, and the audit history.

## Screens and components (every one needs empty, loading and error states — see `states.md`)

### 1. Login
Single seeded member (email + password). Errors: wrong credentials, too many attempts
("Try again in a minute"). Mentions sessions end after 15 minutes of inactivity.

### 2. Session timeout warning
A non-blocking dialog 2 minutes before the 15-minute idle timeout: "You'll be signed out in
1:59 for your security." Buttons: **Stay signed in** (primary), Sign out. After timeout:
back to login with "You were signed out after 15 minutes of inactivity."

### 3. Monthly summary
- Month picker (prev / next arrows + a month select). Default is the current month.
- Three headline numbers: **Income**, **Spend**, **Net**. Next to Spend: "+ $312.75 pending"
  (pending is excluded from totals but shown).
- **Spend by category**: horizontal CSS bars sorted by amount, each with label, amount and
  share. A category can be **negative** (a refund larger than that month's charges): show a
  bar on the other side of the axis or a "net refund" label.
- **Uncategorized** is its own row in the breakdown, visually distinct (dashed/striped bar),
  with the nudge below.
- **Uncategorized nudge**: "3 transactions need a category" → filters the list to them.
- **Flags** row when relevant: "1 credit isn't categorized, so it's not counted as income",
  "1 non-USD transaction excluded".
- **Empty month**: "No transactions in November yet." + button "Jump to October 2026".

### 4. Transactions list
- Filters: category (multi-choice incl. **Uncategorized**), date range (from/to, local
  dates), status (all / posted / pending), account (Checking / Card), search (merchant or
  description). Filters live in the URL; a "Clear filters" link; count of results.
- Desktop: a table (date, merchant + description, account, category, amount). Mobile: a
  stacked list (merchant + amount on line 1, date · category on line 2).
- Row labels/badges:
  - **Pending** badge (and muted amount; tooltip "Pending: may change when it posts. Not in totals.")
  - **Refund** label for a credit in a spending category (amount shown as `+$24.00` with "Refund")
  - **Transfer** label for moves between the member's own accounts (excluded from totals)
  - **Income** for credits categorized income
  - **Uncategorized** chip that is itself the button to pick a category
- Inline category picker on each row (select or popover), keyboard accessible.
- "Load more" at the bottom (cursor pagination).

### 5. Recategorize flow
- Picking a new category updates the row **immediately** (optimistic), and the summary and
  set-aside card update too.
- On failure the row snaps back and a **toast** says "Couldn't save the category. Ledgerly
  didn't respond — try again." with **Retry**. Toasts are an ARIA live region.
- On success a quiet toast "Saved to Ledgerly" (auto-dismiss).
- **Merchant-rule prompt** right after a successful recategorize, inline under the row or as
  a toast with actions: "Apply *Software* to 4 other Figma transactions? Future Figma
  transactions too." [Apply] [Not now]. Only for uncategorized rows of that merchant.
- **Stale edit**: if the transaction changed in Ledgerly since the member loaded it:
  "This transaction changed in your bank feed. Review and try again."

### 6. AI category suggestion chips (future, behind a flag)
For an uncategorized row with an unseen merchant: a small chip "Suggested: Travel" with a
sparkle-free, plain icon, [Accept] / dismiss. Clearly a suggestion, never auto-applied.
"Suggestions come from an AI model and can be wrong."

### 7. Transaction detail drawer + audit history
Fields: merchant, amount (signed), date, account, status, category picker, description.
**History** timeline: "Category changed from Uncategorized to Travel · you · Nov 27, 2:14 PM",
"Synced from Ledgerly", "Posted (was pending; amount changed from $312.75 to $318.40)".

### 8. Sync status, vendor-down and stale data
- Header shows "Synced 2 min ago" + **Refresh** button (spinner while syncing; disabled
  while running).
- **Vendor down** banner (warning, not error red): "We can't reach your bank feed right now.
  Showing data from 10:42 AM. Changes can't be saved until it's back." Recategorize controls
  are disabled with that reason.
- **Stale** banner when last sync > 10 min: "Last updated 2 hours ago." [Refresh]
- **Quarantined rows**: "2 transactions from your bank couldn't be read. We're looking into it."

### 9. Tax set-aside card (our feature — the most important design moment)
Purpose: self-employed members have no withholding and under-save for quarterly estimated
taxes. Categorizing expenses lowers their estimated profit, so it lowers the estimate. That
is the incentive to categorize.
- Title: "Set aside for taxes · Q4 (Sep–Dec)". Subtitle: "Federal estimated payment due
  Jan 15, 2027 · 49 days".
- Big number: **Estimated set-aside $2,103.00** (= profit × rate). Small "25% of $8,412
  profit · Edit rate".
- **Progress bar** toward the target: "$1,200 of $2,103 set aside". Status pill: **On track**
  (green) or **$903 behind** (amber). Neither is red: no shame.
- **Incentive line** (when there are uncategorized debits in the quarter): "Categorize 3
  transactions. Your estimate could drop by about $78." → filters the list.
- **Mark as set aside**: button opening a small form (amount, prefilled with the gap) →
  success state "Nice. $903 set aside for Q4." (this is the success event).
- Edit rate: inline number field 0–60 % with help text.
- Footer, always: "An estimate, not tax advice. Meals count at 50%; personal and transfers
  don't count."
- No streaks, badges or confetti.

## Tone
Plain, kind, specific. Say what happened and what to do. Never blame the member. Never say
"error 502".
