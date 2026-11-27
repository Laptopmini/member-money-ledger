# Prompt for Claude Design

Upload these **8 attachments in this order**, then paste the prompt below.

1. `PROMPT.md` (repo root): the take-home brief
2. `CONTRACT.md` (repo root): the bank-data vendor's API
3. `vendor/seed.json`: the real sample data
4. `docs/design/handoff/design-brief.md`: **the main brief**: every screen and component
5. `docs/design/handoff/states.md`: empty / loading / error states per component
6. `docs/design/handoff/categories.md`: the category list and how to show unknown ones
7. `docs/design/handoff/api-examples.json`: real response shapes, including errors
8. `docs/design/handoff/flags-and-roadmap.md`: feature flags and what ships later

---

## Paste this

You're designing the UI for a small web app for **self-employed business owners** to
understand their money and set aside enough for quarterly taxes. Engineers are building it
in parallel in React with **plain CSS and custom-property tokens**. No UI kit, no chart
library, no Tailwind. Your output will be applied directly to the code, so precision and
consistency matter more than visual flourish.

Read the attachments in order. `design-brief.md` is the main brief and lists every screen and
component, **current and future**. Design all of them: this is the only design session.
`states.md` lists the empty, loading and error states you must cover. Use the real data in
`seed.json` and `api-examples.json` for content (merchants, amounts, dates), not lorem ipsum.

**Hard requirements**
- Light **and** dark themes from one set of tokens.
- Mobile **375 px** and desktop **1280 px** layouts for each screen.
- WCAG 2.2 AA: contrast ≥ 4.5:1 for text, ≥ 3:1 for UI boundaries and focus rings; a
  visible focus style on every interactive element; targets ≥ 24 px (44 px on mobile); never
  color alone (income/spend/refund also carry a sign or a word).
- A system font stack, or at most one self-hosted variable font. Tabular numbers for money.
- No external assets at runtime: no web fonts from CDNs, no remote images. Icons are
  inline SVG using `currentColor`.
- Smooth, short transitions (150–250 ms) and animations for state changes (optimistic
  update, toast in/out, drawer/sheet, progress bar fill, skeleton shimmer), all disabled
  under `prefers-reduced-motion`.
- The tax set-aside card is the product's signature moment. It should feel encouraging and
  calm, never alarming. No streaks, badges or confetti.

**Deliver a "handback" zip** with exactly this layout:

```
handback/
  README.md        what's in the zip, the design decisions, and how to apply it to a React + CSS app
  tokens.css       :root custom properties (color, space, radius, shadow, font, motion, z-index),
                   dark overrides under @media (prefers-color-scheme: dark) and [data-theme="dark"],
                   light overrides under [data-theme="light"]
  components.md    for each component: anatomy, variants, every state, the CSS class names you used,
                   keyboard behaviour and ARIA notes
  screens/         static HTML mockups, one file per screen, each showing 375 and 1280 widths
                   (side by side or stacked), using ONLY tokens.css plus a shared screens/base.css;
                   no frameworks, no JS needed except for theme toggling
    login.html
    app-overview.html        (summary + set-aside + transactions, the main screen)
    transactions-states.html (empty, filtered-empty, loading, error, vendor-down, stale)
    recategorize.html        (picker, optimistic, error toast, merchant-rule prompt, stale edit, AI chip)
    detail-drawer.html       (with audit history)
    set-aside-states.html    (on track, behind, incentive, mark-as-set-aside form + success, no income)
    session-timeout.html
  icons/*.svg      any icons you used (16/20/24 px, currentColor)
```

Use semantic, BEM-ish class names (`.txn-row`, `.txn-row__amount`, `.badge--pending`) so the
engineers can lift the CSS. Keep `tokens.css` the single source of truth for every color and
size. List in `README.md` anything in the brief you chose to change and why.
