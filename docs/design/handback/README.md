# Collective · Member Money: design handback

This is the UI design for the Member Money app: the monthly summary, the tax set-aside card, transactions,
recategorizing, the detail drawer, sync and vendor states, login and session timeout. It's written so the CSS
can be lifted straight into a React app that uses plain CSS and custom properties.

## What's in the zip

| Path | What it is |
|---|---|
| `tokens.css` | The single source of truth: color, space, radius, shadow, font, motion and z-index. Light on `:root`, dark under `prefers-color-scheme` and `[data-theme="dark"]`, light again under `[data-theme="light"]`, and all durations set to 0 under `prefers-reduced-motion`. |
| `screens/base.css` | Every component's CSS, reading only tokens. Sections 1–15 are production CSS; section 16 (`.mock-*`) is scaffolding for the mockups, so don't ship it. |
| `components.md` | For each component: anatomy, variants, every state, class names, copy, keyboard and ARIA notes. |
| `screens/*.html` | Static mockups, each showing 375 px and 1280 px frames side by side, plus a theme switch at the top. They use only `tokens.css` and `base.css`; the only JS is the theme switch. |
| `icons/*.svg` | 29 icons on a 20 × 20 viewBox with a 1.75 stroke in `currentColor`. They render at 16, 20 or 24 px via `.icon--sm`, `.icon` and `.icon--lg`. |

**Screens**

| File | Contents |
|---|---|
| `login.html` | Default, busy, wrong credentials, too many attempts, server unreachable, signed out by timeout |
| `app-overview.html` | The main screen, the account menu, and the summary's loading, error, empty-month and flags + negative-category states |
| `transactions-states.html` | Empty, filtered-empty, loading, error, vendor down, stale, quarantined rows, sync statuses, every row kind, load more, the category filter menu and the mobile filter sheet |
| `recategorize.html` | Picker → saving → saved, merchant-rule prompt, rollback + Retry, stale edit, disabled while the vendor is down, AI suggestion chip |
| `detail-drawer.html` | Side panel and bottom sheet, history after a recategorize and posting, loading, not found, empty history, vendor down |
| `set-aside-states.html` | Behind + incentive, on track, mark-as-set-aside form, success, edit rate, no income, loading, error |
| `session-timeout.html` | The non-blocking warning, and the login screen after the timeout |

Open any file directly in a browser; there's no build step.

## How to apply it to a React + CSS app

1. **Copy the CSS.** Copy `tokens.css` and `screens/base.css` into the app (say `src/styles/`), delete
   section 16 (`.mock-*`) from `base.css`, and import tokens first, then base, once at the root.
2. **Set up the shell.** Render `<div className="app">` as the shell. It's the container that every responsive
   rule queries (`@container app (min-width: 900px)`), so components adapt to the shell's width, not the
   window's. `.app` is `100dvh`, and `.app__main` scrolls.
3. **Put overlays inside the shell.** Render the drawer, scrim, toasts and session dialog as the last children
   of `.app`, not in a portal on `body`. They're `position: absolute` inside the full-height shell, which
   behaves like `fixed` and still picks up the container query.
4. **Theme.** Use `document.documentElement.dataset.theme = 'light' | 'dark'`, and delete the attribute for
   System. Persist the choice to `localStorage` inside try/catch.
5. **Copy markup from the mockups.** Class names are BEM-ish (`.txn-row__amount`, `.badge--pending`), and
   runtime states are `.is-*` (`is-saving`, `is-busy`, `is-flash`, `is-rolled-back`, `is-selected`). Data
   values go in custom properties inline: `style={{'--share': '42%'}}` on a bar, and `--progress` on the
   set-aside bar.
6. **Icons.** Inline the SVGs, for example via SVGR with `className="icon"`. Never load them from a URL at
   runtime.
7. **Money.** Keep integer cents everywhere and format only at the edge, as `$1,234.56` with a `+` or `−`
   (U+2212). Wrap amounts in `.money` so they get tabular figures.

## Design decisions

- **Calm by default.** Amber means "needs attention" (vendor down, "$919.25 to go"). Red appears only for
  errors the member can act on: a failed save, a login error. The tax card never uses red.
- **Category colors are calm hues only**: blue, teal, green, purple, indigo, olive, sky and slate. Every
  category bar and dot also has a visible label, so color is never the only signal.
- **Never color alone.** Money always carries a sign or a word badge (Income, Refund, Transfer, Pending, "Not
  in income yet", "EUR · not in totals"). Pending is a dashed badge with a tooltip.
- **One breakpoint, container-based.** At 900 px the layout switches to a two-column top row and a table. Below
  that, transactions become stacked rows: merchant + amount, then the description, then date · account, then
  the category pill.
- **A native `<select>` styled as a pill** for the category picker in rows. It gives the OS picker on mobile,
  type-ahead, full keyboard and screen-reader support, and no popover code. The drawer has a richer radio grid
  with hints ("Counts at 50%", "Doesn't lower your taxes").
- **Compact controls.** Pills and header buttons are 32 px at every width (this came out of design review).
  Category pills keep a 44 px invisible tap area on mobile. Header buttons are 32 px, which is above the 24 px
  WCAG 2.2 AA minimum.
- **Optimistic recategorize.** The row, summary, nudge, set-aside estimate and incentive all update together.
  A rollback is a small shake plus an error toast with Retry. A stale edit is explained inline on the row
  rather than in a toast, because the message belongs to that row.
- **Filters live in the URL.** The date range defaults to the chosen month, and changing the month resets it.
- **Contrast is verified.** Every text-on-surface token pair the components use meets 4.5:1 in both themes, and
  boundaries, focus rings and category colors meet 3:1. I checked this with a script against `tokens.css`.

## Changes from the brief, and why

1. **"$919.25 to go" instead of "$903 behind".** It's the same amber pill with a calmer word, in line with the
   brief's own "no shame" goal.
2. **Numbers come from the provided data, not the brief's examples.** The estimate is **$2,119.25**: 25% of
   $8,477.00 profit, where profit is $8,500.00 income minus $23.00 deductible (meals at 50%). The incentive is
   **$78.19** (25% of the $312.75 uncategorized Delta debit). These match `api-examples.json`. The brief's
   $2,103 and $78 don't.
3. **The theme toggle lives only in the account menu**, not in the header (from design review).
4. **Refresh is icon-only with a tooltip**, and "Synced 2 min ago" stays visible as text next to it (from design
   review).
5. **Pending, uncategorized spend in "Spend by category" shows an empty dashed bar**, not a filled one. It isn't
   in totals, so a full bar would visually outweigh real spend. Rows also have a dashed dot and the text
   "1 pending · not in totals yet".
6. **The negative category uses the "net refund" label option**, not a bar on the other side of an axis:
   `+$24.00` with a "Net refund" badge and the sentence "More came back than you spent. Lowers your spend."
7. **The merchant-rule prompt is inline under the row**, not a toast. It stays next to the decision it refers
   to and doesn't race the "Saved to Ledgerly" toast.
8. **"Income" is disabled in the picker for money-out rows**, because only credits count as income.
9. **Illustrative rows.** The seed has no transfer, uncategorized credit, non-USD row or second Delta charge.
   Those examples use labeled illustrative merchants (Savings ••4410, Stripe payout, Notion Labs in EUR, and
   "2 other Delta Air Lines transactions"). `txn_000031 groceries` is used for the unknown-category chip.
10. **No category icons.** The brief marks them optional. The color dot plus label is enough and keeps rows
    calm. The icon set has room to add them.
11. **Settings, the accounts filter with balances, and the Reconcile view** (the "Later" items) aren't designed.
    The account menu is the natural entry point for Settings.

## Feature flags

Each flag hides its UI completely when it's off.

| Flag | Default | What it hides |
|---|---|---|
| `tax-set-aside` | on | The whole card is removed and the summary spans the top row |
| `auth-required` | on | Login, the session warning and Sign out |
| `merchant-rules` | off | The inline rule prompt |
| `category-suggestions` | off | The suggestion chip, its "Thinking…" state and its disclaimer line |
