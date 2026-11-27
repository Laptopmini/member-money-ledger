# Components

Every class below lives in `screens/base.css` and reads only `tokens.css`. Classes are BEM-ish:
`.block`, `.block__element`, `.block--variant`, and `.is-state` for transient runtime states.

**Global rules**

- **Breakpoint:** one container query, `@container app (min-width: 900px)`. `.app` (and `.login`) declare
  `container: app / inline-size`. Below 900 px is "mobile", 900 px and up is "desktop".
- **Focus:** every interactive element gets a 2 px `--color-focus` outline with a 2 px offset through one
  `:focus-visible` rule. Custom controls (segmented, cat-option, cat-picker) move the ring to the visible box.
- **Targets:** 44 px on mobile (`--control-h-touch`), 40 / 32 px on desktop (`--control-h`, `--control-h-sm`).
  Nothing interactive is smaller than 24 px.
- **Money:** `.money` = tabular figures and no wrapping. Always render the sign (`+$8,500.00`, `−$45.99`, using
  U+2212 for minus) **or** a word badge. Color (`.money--in`) is extra, never the only signal.
- **Motion:** all durations come from `--dur-*`, which drop to `0ms` under `prefers-reduced-motion`.
  Spinners, shimmer, shake and row flash are also switched off there.

---

## 1. App shell — `.app`, `.app__main`, `.skip-link`

**Anatomy:** skip link → `.app-header` → `.app__banners` (0–n `.banner`) → `main.app__main` → `.layout`.
Overlays (`.scrim`, `.drawer`, `.dialog`, `.toast-region`) are the last children of `.app`.

- `.app` is `100dvh` with `overflow: hidden`. `.app__main` scrolls. Overlays are `position: absolute` inside
  `.app`, so they behave like `fixed` and still see the container query.
- `.layout`, mobile: summary → set-aside → transactions, one column. Desktop: `summary | setaside`
  (`minmax(360px, 400px)` right column), with transactions spanning both columns underneath.

**A11y:** `<a class="skip-link" href="#main">` is the first focusable element. One `<main id="main">`.

## 2. Header — `.app-header`

| Element | Class | Notes |
|---|---|---|
| Brand | `.app-header__brand`, `__brand-mark`, `__brand-sub` | "Money" is hidden on mobile |
| Month picker | `.month-picker` (`.app-header__month`) | prev button · `<select>` · next button |
| Sync status | `.sync-status` + `--stale`, `--never`, `--down` | dot + text; the word "Synced" is hidden on mobile |
| Refresh | `.has-tooltip > .btn.btn--secondary.btn--sm.btn--icon` + `.tooltip--below` | Icon only at every width. The tooltip text is its accessible name (`aria-labelledby`): "Refresh", "Refreshing…", "Try again" or "Sync now" |
| Account menu | `.account-menu`, `__button`, `__avatar`, `__name`, `.menu` | |

**Layout:** mobile is two rows (`brand | actions`, then the full-width month picker). Desktop is one row of
64 px. Header buttons are 32 px (`--control-h-sm`) at every width, so the mobile header stays compact.
The theme toggle is not in the header; it lives only in the account menu.

**Month picker**
- Prev / next are `btn--ghost btn--icon btn--sm`, with `aria-label="Previous month, September 2026"`.
  Next is `disabled` on the current month.
- The default is the current month (November 2026 on Nov 27). When it's empty, the summary offers "Jump to
  October 2026" (`latest_month_with_data`).
- Changing the month resets the transactions date filter to that month (see README).

**Sync states:**

| State | Text | Refresh |
|---|---|---|
| ok | "Synced 2 min ago" (green dot) | enabled |
| syncing | "Syncing…" | `.is-busy`, `disabled`, tooltip "Refreshing…" |
| stale | "Updated 2 hours ago" (grey dot) | enabled; a stale banner also shows |
| down / failed | warning icon + "Bank feed offline" or "Last sync failed" | tooltip becomes "Try again" |
| never | "Not synced yet" | tooltip "Sync now" |
| throttled (429) | — | error toast: "Refreshing too often. Try again in 10 seconds." |

`.sync-status` has `role="status"`, so state changes are announced politely. The relative time re-renders
every minute but isn't announced.

**Account menu:** `button[aria-haspopup="menu"][aria-expanded]` opens `.menu[role="menu"]`. Inside: signed-in
identity, theme segmented control, and "Sign out" (`.menu__item[role="menuitem"]`).
- Esc closes the menu and returns focus to the button.
- Arrow keys move between menuitems. Tab leaves the menu and closes it.

## 3. Theme toggle — `.segmented`

A `<fieldset>` with a visually hidden `<legend>Theme</legend>`, holding three radios
(`.segmented__option > input + .segmented__label`): Light · Dark · System.

- **Behavior:** Light and Dark set `<html data-theme="…">`. System removes the attribute. Persist the choice
  in `localStorage`, and wrap the access in try/catch.
- **Keyboard:** native radios (arrow keys change the choice, Tab moves in and out of the group).

The same component is used for the Status filter (All / Posted / Pending).

## 4. Buttons — `.btn`

**Variants:**

| Class | Use |
|---|---|
| `--primary` | One per region |
| `--secondary` | Bordered |
| `--ghost` | Text-coloured, no border |
| `--icon` | Square, for icon-only buttons; needs an `aria-label` |
| `--sm` | Desktop compact (32 px) |
| `--block` | Full width |

**States:** hover · `:focus-visible` · `:disabled` / `[aria-disabled="true"]` · `.is-busy` (spins its icon, or
holds a `.spinner`; pair it with `disabled` and change the label, e.g. "Signing in…").

`.link-button` is a button styled as a link, for inline actions like "Edit rate".

## 5. Badges, pills, tooltip

**Badges (`.badge`):** each one always carries a word.

| Modifier | Text | Used on |
|---|---|---|
| `--pending` | "Pending" + clock | Dashed border. Rendered as a `<button>` so it can be focused for its tooltip. |
| `--income` | "Income" | Credits categorized as income |
| `--refund` | "Refund" | A credit in a spending category |
| `--transfer` | "Transfer · not counted" | |
| `--neutral` | "Not in income yet" | Uncategorized credit |
| `--excluded` | "EUR · not in totals" | Non-USD rows |

**Pills (`.pill`):** `--on-track` (check icon, "On track") and `--behind` (clock icon, "$919.25 to go").

**Tooltip:** `.has-tooltip > trigger + .tooltip[role="tooltip"]`. `.tooltip--below` opens it downward (header). The trigger has `aria-describedby` pointing
at the tooltip.
- It shows on hover **and** on focus, and Esc hides it.
- `.tooltip--end` right-aligns it, for triggers near the right edge such as the amount column.

## 6. Fields

**Anatomy:** `.field` > `.field__label` + control + `.field__hint` / `.field__error`.

**Controls:** `.input`, `.select` (wrap it in `.select-wrap` with a chevron icon), `.textarea`.
- Affixes: `.input-affix--prefix` (`$`, search icon), `--suffix` (`%`), `--button` (password "Show").
- Group several controls in `<fieldset class="field field--fieldset">` with a `<legend class="field__label">`
  (Dates, Status).

**States:** hover · focus (focus border plus ring) · `aria-invalid="true"` (2 px danger border, plus an error
message linked with `aria-describedby`) · `:disabled`.

## 7. Banners — `.banner`

These are page-level notices that sit directly under the header.

**Anatomy:** `__icon` · `__body` (`__title` + sentence) · `__actions`.

| Variant | When | Copy |
|---|---|---|
| `--warning` | Vendor down | "We can't reach your bank feed right now. Showing data from 10:42 AM. Changes can't be saved until it's back." [Try again] |
| `--info` | Stale (> 10 min) | "Last updated 2 hours ago." [Refresh] |
| `--neutral` | Quarantined rows | "2 transactions from your bank couldn't be read. We're looking into it." |

- Uses `role="status"`. Banners never steal focus.
- Vendor down is amber, not red: nothing the member did is wrong.

## 8. Card — `.card`

`__header` (`__title`, `__subtitle`) · `__body` · `__footer`. The radius is `--radius-lg` and the shadow is
`--shadow-sm`. Padding is 16 px on mobile and 20/24 px on desktop.

## 9. Monthly summary — `.summary` (a `.card`)

**Anatomy:**

1. **Stats:** `dl.stats` with three `.stat` items (`__label`, `__value`, `__meta`).
   - Income shows `+$8,500.00` and "1 deposit".
   - Spend shows `−$45.99`, with "+ $312.75 pending" as `__meta`. Pending is excluded from totals but shown.
   - Net is signed; `.stat--net` spans the full width on narrow cards.
2. **Spend by category:** `ul.breakdown` of `.bar-row`.
   - Each row has `__label` (a button with a `.cat-dot`; it filters the list), `__amount` (with
     `__share` = % of spend), `__track` / `__fill` (`--share` custom property), and `__count`.
   - Rows are sorted by amount. Bar length is relative to the largest row, so the largest is 100%.
   - Bar color comes from `.cat--{key}` → `--cat-color`. The palette uses calm hues only (blue, teal, green,
     purple, indigo, olive, sky, slate). No red, orange, amber or pink, which read as warnings. Labels are
     always visible.

**Bar row variants:**

| Variant | Look | Meaning |
|---|---|---|
| `--uncategorized` | Dashed dot, striped fill | Always its own last row |
| `--pending` | Dashed empty track, "not in totals yet" | Uncategorized pending rows |
| `--negative` | Dashed empty track, `+$24.00` in positive color, a "Net refund" badge, and the sentence "More came back than you spent. Lowers your spend." | A category with more refunds than charges |
| `--zero` | Grey track | e.g. Software: "a $24.00 charge and its refund cancel out" |

3. **Nudge** (`.nudge`): "1 transaction needs a category. It helps your tax estimate." with a [Review it]
   button. It filters the list to `category=uncategorized` and moves focus to the list heading.
4. **Flags** (`ul.flags`, `.flag`): only shown when they apply.
   - "1 credit isn't categorized, so it's not counted as income. Review it"
   - "1 non-USD transaction excluded. See it"

**States:**

| State | What shows |
|---|---|
| Loading | Skeleton numbers and bars, `aria-busy="true"`, with a visually hidden "Loading the summary…" status |
| Error | "Couldn't load the summary" + [Retry] (`role="alert"`) |
| Empty | Zeroed stats + "No transactions in November yet." + [Jump to October 2026 →] |

## 10. Tax set-aside card — `.setaside` (a `.card`, flag `tax-set-aside`)

**Anatomy:**

1. **Header:** "Set aside for taxes · Q4 (Sep–Dec)" and "Federal estimated payment due Jan 15, 2027 · 49 days".
2. **Estimate:** `__eyebrow` "Estimated set-aside", then `__amount` **$2,119.25**.
3. **Formula:** `__formula` "25% of $8,477.00 profit · Edit rate", where Edit rate is a `.link-button` with
   `aria-expanded`.
4. **Progress:** `__progress` holds `__progress-text` ("**$1,200.00** of $2,119.25 set aside"), a `.pill`,
   and `.progress > .progress__fill` (`--progress`).
   - The bar has `role="progressbar"` with `aria-valuetext` in words.
   - The fill is accent blue while short of the target and green when on track (`.progress--behind`
     switches it). The pill carries the meaning.
5. **Incentive:** `__incentive`, shown only if the quarter has uncategorized debits: "Categorize 1
   transaction. Your estimate could drop by about **$78.19**. Review it". The link filters the list.
6. **Actions:** `__actions` with [Mark as set aside].
7. **Footer** (always shown): "An estimate, not tax advice. Meals count at 50%; personal and transfers don't
   count."

**States:**

| State | What shows |
|---|---|
| Behind | Amber pill "$919.25 to go", blue fill at 57% |
| On track | Green pill "On track", full green bar; the button becomes "Mark more as set aside" (secondary) |
| Incentive | As above |
| Mark-as-set-aside form | `.setaside__form` with an amount input (`$` prefix, prefilled with the gap `919.25`) and the hint "This is a note for you; we don't move money." [Save] [Cancel] |
| Success | `.setaside__success[role="status"]`: "Nice. $919.25 set aside for Q4." The bar animates to the new value (250 ms). |
| Edit rate | `.setaside__rate`: a number input `0–60` with a `%` suffix, help text, [Save] [Cancel]. The amount and formula recompute. |
| No income | "$0.00" in subtle text, plus "Once income arrives we'll estimate what to set aside." |
| Loading | Skeleton |
| Error | "Couldn't estimate your set-aside" + [Retry] |
| Flag off | The whole card is removed, and the summary takes the full width (`.layout` keeps working with an empty column). |

**Keyboard:**
- After [Save] in the form, focus moves to the success message (`tabindex="-1"`).
- Cancel returns focus to the button that opened the form.
- Esc inside the form cancels.

No streaks, badges, confetti or red anywhere in this card.

## 11. Transactions — `.txns` (a `.card`)

**Header:** title + `.txns__count[role="status"]`, e.g. "5 transactions in October 2026" or "1 of 5
transactions". It updates politely when filters change.

### Filters — `.filters`

**Mobile, `.filters__mobile`:**
- A search input and a [Filters (n)] button. The button opens a filter sheet: a `.drawer` with category
  checkboxes (`.cat-option`), dates, status, account, and [Show N transactions] / "Clear filters".
- Active filters show below as `.filter-chip` items, each with a remove `button[aria-label="Remove filter:
  Travel"]`, followed by "Clear filters".

**Desktop, `.filters__inline`:**
- Search · Category (`details.filter-menu` → `.menu` of checkboxes, Uncategorized first, [Apply] [Clear]) ·
  Dates (two `type="date"` inputs) · Status (`.segmented`) · Account (`select`).

**URL state:** all filters live in the URL, e.g.
`?category=uncategorized,travel&from=2026-10-01&to=2026-10-31&status=pending&account=acc_card&q=figma`.
Clear filters resets to the chosen month.

### List — `.txn-list__head` + `ol.txn-list` of `li.txn-row`

`.txn-list__head` is `aria-hidden` and desktop-only. Each row, in DOM order:

| Element | Class | Notes |
|---|---|---|
| Main | `__main` | `button.__open` (merchant, opens the drawer) + `__desc` |
| Meta | `__meta` | `__date` (`<time>`) · `__account` |
| Category | `__category` | `.cat-picker`, plus an optional `.suggestion` |
| Amount | `__amount` | `.money` + `__amount-label` badge |
| Note | `__note` | Optional: rule prompt, stale message, AI disclaimer |

**Layout:**
- Mobile: line 1 is merchant + amount, line 2 is description, then date · account, then the category chip.
  The badge sits under the amount.
- Desktop grid: `Date 96px | Merchant | Account 88px | Category | Amount 180px (right-aligned)`. `__meta` uses
  `display: contents`. Amount badges may wrap to two right-aligned lines; nothing overflows the row.

**Whole-row click:** `.txn-row__open::after` covers the row, so clicking anywhere opens the drawer. The
picker, badges and notes sit above it with `z-index: 1`, so they stay independently clickable.

**Modifiers:**

| Modifier | Effect |
|---|---|
| `--pending` | Muted amount, Pending badge with the tooltip "Pending: may change when it posts. Not in totals." |
| `--refund` | `+$24.00` and "Refund" |
| `--income` | "Income" badge |
| `--transfer` | Muted amount, "Transfer · not counted" |
| `--excluded` | Non-USD; muted amount, "EUR · not in totals" |
| `.is-selected` | Row whose drawer is open |
| `.is-flash` | 200 ms accent-soft fade after an optimistic update or a stale refresh |

**Unknown synced category** (e.g. `groceries`): a neutral `.cat-picker--other` chip showing the raw key plus
"from bank". The select lists it as "groceries (from your bank)" and offers the known categories to move to.

### States

| State | Copy and behavior |
|---|---|
| No data | "Your transactions will appear after the first sync" + [Sync now] |
| Filters match nothing | "No transactions match these filters" + [Clear filters] |
| Loading | Skeleton rows with the same geometry as real rows |
| Error | "Couldn't load transactions" + [Retry] |
| Vendor down | Cached rows stay visible, pickers are disabled, and the banner shows |
| Load more | `.load-more` with [Load more] → busy ("Loading more…", `disabled`) → end ("That's everything for October 2026.") |

Load more uses cursor pagination; keep focus on the first newly loaded row.

## 12. Category picker — `.cat-picker`

A native `<select>` overlays the chip (`opacity: 0`). The pill is 32 px tall with 12 px left padding and 14 px
medium text at every width; on mobile the select extends 6 px above and below, so the tap area is 44 px. The chip shows `.cat-dot` + `.cat-picker__value` +
chevron. This gives you the OS picker on mobile, type-ahead, and full keyboard support for free.

**Options:**
- "Uncategorized" first.
- Then optgroups: *Business expenses* · *Not business* (Personal, Transfer) · *Money in* (Income).
- `Income` is `disabled` for debits ("Only credits here count as income").
- **Accessible name:** `aria-label="Category for Delta Air Lines, −$312.75"`.

**Variants:**

| Variant | Look | Meaning |
|---|---|---|
| default (`.cat--{key}`) | Bordered pill with a color dot | Known category |
| `--uncategorized` | Dashed accent border, plus icon, "Uncategorized" | It *is* the button to pick a category |
| `--other` | Sunken neutral pill, "from bank" | Unknown key from the feed |

**States:**

| State | What shows |
|---|---|
| `.is-saving` | Optimistic: the new label shows immediately with a 12 px ring where the chevron was; `aria-busy` on the select |
| `.is-rolled-back` | Snaps back with a 250 ms shake (none under reduced motion) |
| `.is-disabled` | `disabled` select with `aria-describedby` pointing at the reason: "Categories can't be changed while your bank feed is offline." |

**Recategorize flow:**

1. **Change:** update local state immediately. The row, summary, nudge, set-aside estimate and incentive
   recompute together. Then `PATCH /api/transactions/:id {category, expected_updated_at}`.
2. **200:** a success toast "Saved to Ledgerly" (polite, auto-dismisses after 4 s). Then, if flag
   `merchant-rules` is on and N ≥ 1 other *uncategorized* rows share the merchant, show the rule prompt.
3. **502 / timeout:** roll back, plus an error toast: "**Couldn't save the category.** Ledgerly didn't
   respond — try again." [Retry]. Focus stays on the picker.
4. **409 stale:** replace the row with the fresh data (`.is-flash`) and show a `.inline-note--stale`
   (`role="alert"`) under it: "This transaction changed in your bank feed. Review and try again." plus what
   changed. [Review] opens the drawer.
5. **400 invalid_category:** "Pick a category from the list." (only possible with a stale client).

## 13. Merchant-rule prompt — `.inline-note--rule` (flag `merchant-rules`)

Inline under the row (`.txn-row__note`), with `role="status"`: "Apply **Travel** to 2 other Delta Air Lines
transactions? Future Delta Air Lines transactions too." [Apply] [Not now].

- It doesn't take focus; Tab reaches it right after the picker.
- It dismisses on Not now, on Apply (followed by a toast "Applied to 2 transactions"), or when the member
  leaves the row's filter scope.

## 14. AI suggestion chip — `.suggestion` (flag `category-suggestions`)

Same pill spec as `.cat-picker` (32 px, 12 px left padding, 14 px). Shown next to the picker on uncategorized rows with an unseen merchant: "Suggested: **Travel**" [Accept] [×].

- **Accessible names:** `Accept suggestion: Travel` and `Dismiss suggestion`.
- **Disclaimer:** under the row, `.suggestion__note`: "Suggestions come from an AI model and can be wrong.
  Nothing changes until you accept."
- **Thinking:** `.suggestion--thinking` is a dashed chip with a shimmer, for at most 1 s, plus a hidden status
  "Getting a suggestion…". If nothing comes back it disappears.
- **Errors** hide the chip silently. It never blocks the picker and is never auto-applied.
- **Accept** runs the normal recategorize flow.

## 15. Toasts — `.toast-region`, `.toast`

The region (`role="region" aria-label="Notifications"`) contains two live containers that exist from page
load:
- `.toast-region__live[role="status"]` (polite) for success and info.
- `.toast-region__live[role="alert"]` (assertive) for errors.

**Placement:** bottom of the screen, full width on mobile; bottom-right at 380 px wide on desktop.

**Anatomy:** `__icon` · `__body` (text + `__actions` with `.toast__action` / `--primary`) · `__close`
(`aria-label="Dismiss"`).

**Variants:**
- Default (success / info) is inverse: dark on light themes, light on dark. It auto-dismisses after 4 s and
  pauses on hover or focus.
- `--error` is danger-soft with a danger border. It stays until dismissed or until Retry succeeds.

**Motion:** in with `toast-in` (200 ms rise and fade), out with `.is-leaving`.

**Keyboard:** toasts don't take focus. Retry and Dismiss are reachable with Tab; F6 / skip links aren't
required.

## 16. Detail drawer — `.scrim` + `.drawer`

- **Desktop:** 440 px side panel from the right (`drawer-in`, 250 ms).
- **Mobile:** bottom sheet with radius 20, a grab handle, max 88% of the screen height (`sheet-in`). Both are
  modal.

**Anatomy:**

1. **`__header`:** `__eyebrow` "Oct 14, 2026 · Card", `__title` "Delta Air Lines", a close icon button, and
   `__amount-row` (`−$312.75` + Pending badge).
2. **`__body`:**
   - `.detail-list` (Date, Account, Status, Direction).
   - **Category:** a `.cat-options` radio grid, grouped Needs a decision / Business expenses / Not business /
     Money in. Each `.cat-option` can carry a `__hint` ("Counts at 50%", "Doesn't lower your taxes", "Between
     your own accounts", "Money in only"). Selecting one runs the same optimistic flow.
   - **Description:** textarea, [Save description].
   - **History:** `.history`.

**History (`ol.history > .history__item`):** newest first. Each item has a `__marker` (`--you` for the
member's own edits), `__text`, and `__meta`. Examples:
- "Category changed from Uncategorized to Travel · You · Nov 27, 10:41 AM"
- "Synced from Ledgerly"
- "Posted (was pending; amount changed from $312.75 to $318.40)"

**States:**

| State | What shows |
|---|---|
| Loading | Skeleton, `aria-busy` |
| Not found | "This transaction is no longer in your bank feed" + [Back to transactions] |
| History empty | "No changes yet." |
| Vendor down | Radio options and the description are disabled |

**Keyboard / ARIA:**
- `role="dialog" aria-modal="true" aria-labelledby` the title.
- On open, focus moves to the close button. Focus is trapped inside.
- Esc or a scrim click closes it, and focus returns to the row's `__open` button.
- The row gets `.is-selected` while the drawer is open. The URL gains `?txn=txn_000004`, so the drawer can be
  linked and survives a reload.

## 17. Session-timeout dialog — `.dialog`

It's non-blocking: no scrim, and the page stays usable. On desktop it sits bottom-right at 400 px; on mobile it
spans the bottom.

**Anatomy:**
- `__icon` (clock).
- `__title` "Still there?".
- `__text` "You'll be signed out in **1:59** for your security." (`__countdown` holds a `<time>`).
- `__actions`: [Stay signed in] (primary) and [Sign out].

**Timing:**
- It appears at 13:00 of idle time. "Stay signed in" pings the session and closes the dialog.
- At 15:00 the member lands on the login page with the info alert "You were signed out after 15 minutes of
  inactivity."

**ARIA:**
- `role="alertdialog" aria-modal="false"`, labelled and described. Focus moves to "Stay signed in" when it
  opens.
- The countdown text itself is not live. A separate hidden polite region announces it at 1:00, 0:30 and 0:10.

## 18. Login — `.login`, `.login__card`

**Anatomy:**
- Brand.
- A card with the title "Sign in" and lede.
- An optional `.alert` above the form.
- Email and password fields (password has a [Show] `aria-pressed` toggle).
- [Sign in] (block button).
- `.login__note`: "For your security, you're signed out after 15 minutes of inactivity."

**States:**

| State | What shows |
|---|---|
| Busy | "Signing in…", spinner, disabled |
| Wrong credentials | `.alert--error[role="alert"]` "That email and password don't match." Fields get `aria-invalid`; focus returns to the email field. |
| Throttled (429) | `.alert--warning` "Too many attempts. Try again in a minute."; Sign in is disabled for 60 s |
| Server unreachable | `.alert--warning` "We can't reach Collective right now. Check your connection and try again." |
| Timed out | `.alert--info` "You were signed out after 15 minutes of inactivity."; the email is prefilled |

## 19. Skeletons, empty and error — `.skeleton`, `.state`

**Skeletons:**
- `.skeleton` variants: `--text` (width `--w`), `--num`, `--hero`, `--bar`, `--chip`, `--option`.
- The shimmer runs 1.4 s and is off under reduced motion.
- Skeleton containers get `aria-busy="true"`, with a visually hidden `role="status"` "Loading…".

**Empty and error (`.state`, `.state--compact`):** `__icon`, `__title`, `__text`, and one action. Errors use
`role="alert"`. Copy says what happened and what to do; it never shows a status code.

## 20. Icons — `icons/*.svg`

- 20 × 20 viewBox, 1.75 stroke, `currentColor`.
- Inline them with `class="icon"`, `icon--sm` (16) or `icon--lg` (24). Decorative icons get
  `aria-hidden="true"`; meaningful standalone icons get `role="img" aria-label`.
- **Set:** chevron-left/right/down, refresh, sun, moon, monitor, check, x, alert, info, cloud-off, clock,
  search, sliders, log-out, pencil, history, tag, lightbulb, safe (brand mark), calendar, arrow-right, lock,
  user, plus, bank, swap, file-question.
