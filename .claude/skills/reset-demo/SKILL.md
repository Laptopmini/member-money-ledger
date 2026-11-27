---
name: reset-demo
description: Reset the Ledgerly vendor and our Postgres mirror to a known state for a demo or manual test, optionally loading three months of demo transactions. Use when asked to reset, reseed, or prepare the demo.
---

# Reset demo

1. `make reset-demo` restarts the vendor container (its data is in memory, so it returns to the
   5 seed rows), clears the mirror (transactions, sync runs, rejections, audit events) and syncs.
2. `make reset-demo SEED=1` also POSTs ~60 validated demo rows (Sep–Nov 2026) through the
   vendor's public API, then syncs. The vendor assigns ids, and **reuses them after a restart**
   (trap 15), so always reset the mirror together with the vendor.
3. Verify: `curl -s localhost:8000/api/summary?month=2026-10` → seed-only income is 850000,
   spend 4599, pending 31275.
4. Never edit `vendor/` and never POST rows that bypass `ledger.sync.validate_vendor_row`.
