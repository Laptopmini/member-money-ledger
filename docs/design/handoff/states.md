# States per component

Every component needs these designed. "Loading" uses skeletons (no spinners except on
buttons). Errors are specific and offer the next action.

| Component | Empty | Loading | Error | Other states |
|---|---|---|---|---|
| Login | — | Button busy | Wrong email/password · Too many attempts (wait 1 min) · Server unreachable | Signed out by timeout notice |
| Session warning | — | — | — | Countdown; after "Stay signed in" closes |
| Summary | "No transactions in <Month> yet" + Jump to latest month | Skeleton numbers + bars | "Couldn't load the summary" + Retry | Pending note · Uncategorized nudge · Flags (uncategorized credits, non-USD) · Negative category |
| Transactions list | No data at all: "Your transactions will appear after the first sync" · Filters match nothing: "No transactions match these filters" + Clear filters | Skeleton rows | "Couldn't load transactions" + Retry · showing cached rows with the vendor-down banner | Load more (busy, end of list) · Row: pending, refund, transfer, income, uncategorized, unknown synced category |
| Category picker | — | Saving (optimistic, subtle) | Rolled back + toast with Retry · Stale edit · Disabled when vendor down (with reason) | Merchant-rule prompt after success |
| Detail drawer | — | Skeleton | Not found ("This transaction is no longer in your bank feed") | History: empty ("No changes yet"), list |
| Sync status | Never synced | Syncing… (Refresh disabled) | Vendor down banner · Last sync failed | Stale > 10 min banner · Quarantined rows notice |
| Tax set-aside | No income yet this quarter: "Once income arrives we'll estimate what to set aside" | Skeleton | "Couldn't estimate" + Retry | On track · $X behind · Incentive line · Mark-as-set-aside form + success · Edit rate · Flag off = hidden |
| AI suggestion chip | Hidden when none | "Thinking…" shimmer (≤ 1 s) | Hidden on error (never blocks) | Accept · Dismiss |
| Toasts | — | — | Error (assertive) | Success (polite), with action |
| Theme toggle | — | — | — | Light · Dark · System |
