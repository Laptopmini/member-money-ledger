# 0019. Sync conflict rule: vendor wins, with a race guard

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided at T0 in the build session; the owner picked the recommended option.)
- **Deciders**: Owner (choice), Claude (options)

## Context
Settled rule #7 said to upsert only when the vendor's `updated_at` is `>=` ours. That contradicts rule #11 (vendor is the truth after a restart). Concrete case (trap 14): `txn_000004` is edited locally on 2026-11-27; the vendor restarts and reseeds it with `updated_at` 2026-10-14; `>=` would reject the vendor row, so our stale value stays forever and never converges. `updated_at` also has one-second resolution (trap 7).

## Options
- **Keep `>=`**: simple; never converges after a restart
- **`>=` plus restart detection**: converges; heuristic and fragile
- **Vendor wins on every full sync when the row differs, except rows written locally by a PUT after this run started (chosen)**: converges and protects in-flight edits

## Decision
**Amends settled rule #7.** Vendor wins on every full sync when the row differs, except rows we wrote by PUT after the sync run started (`local_write_at` > run start).

## Consequences
Reused ids after a restart overwrite local rows (trap 15); audit history notes the replacement. Tested by `test_vendor_restart_converges` and `test_put_during_sync_not_overwritten`.
