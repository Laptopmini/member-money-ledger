# Trap register

Where the data or the vendor can trick a naive implementation. **Source**: P = found while
formulating the prompt (`process/01-prompt-formulation.md`), T0 = found while reading the repo at
T0, B = found during the build. **Status**: planned → handled (with test).

| # | Trap | Where | Handling | Test | Source | Status |
|---|---|---|---|---|---|---|
| 1 | Refund credit counted as income | seed `txn_000005` (Figma) | Credit in a spend category nets against that category; income = credits in `income` only | `test_money::test_refund_nets_category` | P | planned |
| 2 | Pending row changes amount/date on posting | seed `txn_000004` | Badge, excluded from totals, `pending_cents`; upsert by id | `test_money::test_pending_excluded`, `test_sync::test_pending_posts_with_new_date` | P | planned |
| 3 | `category: null`, unknown synced categories | seed `txn_000004`; vendor PUT accepts any string | Uncategorized bucket + nudge; accept unknown on read, validate writes | `test_money::test_uncategorized_bucket`, `test_api::test_patch_rejects_unknown_category` | P | planned |
| 4 | `posted_on` local date vs JS `Date` UTC | CONTRACT | Strings end to end; month = `slice(0,7)`; local "current month" | `dates.test.ts` | P | planned |
| 5 | Integer cents + `direction`; non-USD | CONTRACT | One `signed_cents()`; `Intl` at the edge; non-USD excluded + flagged | `test_money::test_non_usd_excluded`, `format.test.ts` | P | planned |
| 6 | Offset cursor duplicates/skips rows; `limit=0`/negative loops | `vendor/server.py::_list` | `limit=100`, stop on null or repeated cursor, upsert by id; 404-confirm before tombstoning | `test_sync::test_repeated_cursor_stops`, `test_duplicate_rows_harmless` | P | planned |
| 7 | `updated_at` one-second resolution | `vendor/server.py::_now` | Store the vendor's PUT response row; race guard (see 14) | `test_sync::test_put_during_sync_not_overwritten` | P | planned |
| 8 | Write-through failure leaves local state changed / leaks vendor errors | — | Validate → PUT → save returned row; mapped error envelope; 502 friendly | `test_api::test_patch_vendor_down_changes_nothing` | P | planned |
| 9 | Path injection into vendor URL | our views | Strict ASCII id regex | `test_vendor::test_rejects_bad_ids` | P | planned |
| 10 | Vendor POST validates nothing | `vendor/server.py::_create` | Our create paths validate everything | `test_seed::test_demo_rows_valid` | P | planned |
| 11 | Vendor is in-memory; restart resets | vendor | Vendor is the truth; sync converges (see 14); E2E restarts vendor | `test_sync::test_vendor_restart_converges` | P | planned |
| 12 | Transfers double count | `acc_checking` pays `acc_card` | `transfer` category excluded from spend and income | `test_money::test_transfer_excluded` | P | planned |
| 13 | Concurrent edits, last write wins | vendor has no ETag | `expected_updated_at` → 409 `stale` | `test_api::test_patch_stale_409` | P | planned |
| 14 | **The `>=` upsert rule never converges after a vendor restart** (reseeded row older than our edit) | rule #7 vs #11 | ADR 0019: vendor wins on full sync, except rows PUT after the run started | `test_sync::test_vendor_restart_converges` | T0 | planned |
| 15 | **Ids reused after a vendor restart** (`_next_id = len(seed)+1`) | `vendor/server.py::_load_seed` | Upsert overwrites (vendor is truth); audit history notes "content replaced"; documented | `test_sync::test_reused_id_overwrites` | T0 | planned |
| 16 | **Malformed rows arrive by sync** (float/negative/string amount, bad direction, bad date) | `vendor/server.py::_create` | ADR 0020: quarantine in `SyncRejection`, excluded, counted in sync status | `test_sync::test_bad_rows_quarantined` | T0 | planned |
| 17 | **Vendor list is unlocked** → can raise mid-request and drop the connection; array bodies crash PUT/POST | `vendor/server.py::_list`, `_update` | Client tolerates non-JSON/resets; bounded retry; we only send dict bodies | `test_vendor::test_non_json_and_reset_retried` | T0 | planned |
| 18 | **Background polling defeats the idle timeout** | `SESSION_SAVE_EVERY_REQUEST` + TanStack refetch | Only `X-User-Activity: 1` requests extend the session | `test_auth::test_poll_does_not_extend_session` | T0 | planned |
| 19 | **ETag keyed by `synced_at` goes stale after a recategorize** | summary caching | ETag from a data version (max local change time); `Cache-Control: private` | `test_api::test_summary_etag_changes_on_recategorize` | T0 | planned |
| 20 | **IRS quarters are not calendar quarters; meals only 50% deductible** | tax set-aside | IRS periods + due dates table; per-category `deductible_fraction` | `test_tax::test_periods`, `test_meals_half` | T0 | planned |
| 21 | **Default month is empty** (today 2026-11-27, seed is Oct 2026) | UX | ADR 0016: current month + "jump to latest month with data"; demo seed fills Nov | E2E | T0 | planned |
| 22 | **Pending rows never post in this vendor** (no code path changes `status`) | vendor | Posting is tested against the fake vendor only; documented | `test_sync::test_pending_posts_with_new_date` | T0 | planned |
| 23 | **A category can be net negative** (refund in a different month from the charge); a debit in `income` is a chargeback | money math | Show signed net per category; debits in `income` net against income | `test_money::test_negative_category`, `test_income_debit_nets` | T0 | planned |
| 24 | **Same-date ties** (`txn_000004`/`txn_000005` both 2026-10-14) | ordering | Order and keyset cursor on `(posted_on desc, id desc)` | `test_api::test_cursor_stable_on_ties` | T0 | planned |
| 25 | **Client-side flag can't gate auth** | `auth-required` | Evaluated server-side; UI only mirrors it | `test_auth::test_flag_evaluated_server_side` | T0 | planned |
| 26 | **Anonymous `node_modules` volume survives `up --build`** | starter compose | Fixed in compose (Stage 1) | manual | T0 | planned |
| 27 | **Starter ships hard-coded `SECRET_KEY`, `DEBUG=True`, `ALLOWED_HOSTS=*`; `/api/ping` 500s when the vendor is down** | `api/config` | Env-driven settings; `/api/health` reports degraded instead of failing | `test_api::test_health_vendor_down` | T0 | planned |
| 28 | `PUT {}` bumps `updated_at` without a change | `vendor/server.py::_update` | Never send a PUT when nothing changed | `test_api::test_patch_noop_skips_vendor` | P | planned |
| 29 | `updated_at` vs `posted_on` dates differ (`txn_000003` updated 00:00:05Z) | seed | Never derive a date from `updated_at` | covered by 4 | T0 | planned |
| 30 | **Oversize strings, NUL bytes, amounts ≥ 2⁶³ from vendor POST/PUT** raise inside the sync transaction and freeze the mirror forever | `vendor/server.py::_create/_update` vs model columns | Length/range/NUL checks → quarantine with specific reasons; NUL stripped from stored payload | `test_hardening::test_oversize_and_nul_fields_quarantined` | B (reviewer) | handled |
| 31 | **Snapshot race**: a PATCH commits between the sync's row load and its save → sync reverts the member's edit | `sync.py` | `select_for_update` + conditional SQL re-check of `local_write_at` | `test_hardening::test_patch_in_snapshot_window_survives` | B (reviewer) | handled |
| 32 | **Check-then-act PATCH** without a lock; mirror-only stale check | `views.py` PATCH | Row lock held through vendor GET + PUT + save; 409 if vendor row changed since sync. Same-second edits remain undetectable (1 s `updated_at`) | `test_hardening` N3 (one xfail, documented) | B (reviewer) | handled (limitation documented) |
| 33 | **Pending transfer inflates "+ $X pending"; pending refunds ignored** | summary | Classify first; skip transfers; net pending refunds; `pending_income_cents` | `test_hardening` N4 | B (reviewer) | handled |
| 34 | **Summary ETag freezes `synced_at`** when a sync changes nothing | summary caching | ETag includes the last ok sync id | `test_hardening` N5 | B (reviewer) | handled |
| 35 | **Truncated listing → N per-row GETs** in the request path; one flaky GET discards the whole run | `sync.py` tombstone pass | Only after a clean listing, capped at 50, GET failure keeps the row | `test_hardening` N6 | B (reviewer) | handled |
| 36 | **A `null` row in a vendor page** crashes the second sync (NOT NULL JSON payload) | `sync.py` quarantine | Payload `{}` for non-dict rows | `test_hardening` N7 | B (reviewer) | handled |
| 37 | **CSRF-able, unthrottled `POST /api/sync`** (no-body form post) | DRF with no auth classes is `csrf_exempt` | Throttles (ADR 0014) + 415 on non-JSON writes now; session auth + CSRF in Stage 4 | `test_hardening` throttle/415 tests | B (reviewer) | handled (auth pending) |
| 38 | **Search text (`?q=merchant`) in access logs** | `django.server`, `gunicorn.access` | Query-string redaction filter | `test_hardening::test_query_redacted_in_logs` | B (reviewer) | handled |
| 39 | **PUT succeeded but the reply was unusable** → we'd claim "nothing changed" | `views.py` PATCH | 502 `vendor_unconfirmed` + refresh that row; UI refetches instead of rolling back | `test_backend_smoke` | B (reviewer) | handled |
| 40 | **Throttle counters are per gunicorn worker** (locmem cache) | settings | Accepted for the demo; a shared cache (Redis/DB) in production | — | B (backend) | documented |
