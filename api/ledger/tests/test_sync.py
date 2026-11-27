"""Sync against FakeLedgerly (no network)."""

from datetime import timedelta

import pytest
from django.utils import timezone

from ledger.models import AuditEvent, SyncRejection, SyncRun, Transaction
from ledger.sync import run_sync, validate_vendor_row
from ledger.tests.conftest import dt


def good(**kw):
    row = {
        "account_id": "acc_checking",
        "posted_on": "2026-10-20",
        "amount_cents": 500,
        "direction": "debit",
        "currency": "USD",
        "merchant": "M",
        "category": "meals",
        "description": "",
        "status": "posted",
        "updated_at": "2026-10-20T10:00:00Z",
    }
    row.update(kw)
    return row


def test_initial_sync_mirrors_seed(db, fake):
    run = run_sync(fake)
    assert run.status == "ok"
    assert Transaction.objects.count() == 5
    t = Transaction.objects.get(pk="txn_000004")
    assert t.category is None and t.status == "pending"


def test_limit_100_always_sent(db, fake):
    """Trap 6: the client is only ever asked for pages of 100 (fake records every request)."""
    fake.page_size = 2
    run_sync(fake)
    assert fake.limits_requested and set(fake.limits_requested) == {100}
    assert Transaction.objects.count() == 5  # multi-page walk still gets everything


def test_repeated_cursor_stops(db, fake):
    """Trap 6: a vendor that returns the same cursor forever must not loop."""
    fake.repeat_cursor = True
    run = run_sync(fake)
    assert run.status == "ok"
    # bounded: a repeated cursor ends a pass; duplicate re-lists are capped
    assert len(fake.calls_named("list_page")) <= 6
    assert Transaction.objects.count() == 5


def test_duplicate_rows_harmless(db, fake):
    """Trap 6: offset drift can return a row twice; upsert by id makes that harmless."""
    fake.page_size = 2
    fake.insert_during_paging = good(id="txn_000900", posted_on="2026-10-30")
    run_sync(fake)
    assert Transaction.objects.filter(pk="txn_000001").count() == 1
    assert Transaction.objects.count() == 6


def test_offset_drift_skip_confirmed_not_deleted(db, fake):
    """Trap 6: a row skipped by paging drift is confirmed via GET, never tombstoned."""
    run_sync(fake)  # mirror all five
    fake.page_size = 2
    # Deleting a first-page row after page 1 shifts everything up by one: txn_000003 is skipped.
    fake.delete_during_paging = "txn_000002"
    fake.post(good(id="txn_000777", posted_on="2026-10-29"))
    fake.calls.clear()
    run_sync(fake)
    assert Transaction.objects.get(pk="txn_000003").deleted_at is None
    assert Transaction.objects.get(pk="txn_000002").deleted_at is not None  # really gone: 404


def test_vendor_404_tombstones_and_excludes(db, fake, fresh_sync):
    """Trap 6: a row confirmed gone is tombstoned and excluded from list and summary."""
    from rest_framework.test import APIClient

    run_sync(fake)
    fake.delete("txn_000002")
    run = run_sync(fake)
    assert run.tombstoned == 1
    row = Transaction.objects.get(pk="txn_000002")
    assert row.deleted_at is not None
    api = APIClient()
    ids = [r["id"] for r in api.get("/api/transactions").json()["results"]]
    assert "txn_000002" not in ids
    assert api.get("/api/summary?month=2026-10").json()["income_cents"] == 0


def test_vendor_restart_converges(db, fake):
    """Traps 11, 14: after a vendor restart the vendor wins even if our local edit is newer."""
    run_sync(fake)
    t = Transaction.objects.get(pk="txn_000001")
    t.category = "travel"
    t.vendor_updated_at = dt("2030-01-01T00:00:00Z")  # newer than anything the seed has
    t.local_write_at = timezone.now() - timedelta(hours=1)  # before the next run
    t.save()
    fake.restart()
    run_sync(fake)
    assert Transaction.objects.get(pk="txn_000001").category == "meals"
    assert Transaction.objects.get(pk="txn_000001").vendor_updated_at == dt("2026-10-28T15:02:11Z")


def test_reused_id_overwrites(db, fake):
    """Trap 15: ids are reused after a restart; the vendor's new content replaces ours."""
    fake.post(good(id="txn_000006", merchant="Old Merchant", amount_cents=111))
    run_sync(fake)
    assert Transaction.objects.get(pk="txn_000006").merchant == "Old Merchant"
    fake.restart()
    fake.post(
        good(id="txn_000006", merchant="New Merchant", amount_cents=222, posted_on="2026-10-22")
    )
    run_sync(fake)
    t = Transaction.objects.get(pk="txn_000006")
    assert (t.merchant, t.amount_cents) == ("New Merchant", 222)


BAD_ROWS: dict[str, dict[str, object]] = {
    "float_amount": {"amount_cents": 12.5},
    "negative_amount": {"amount_cents": -5},
    "string_amount": {"amount_cents": "100"},
    "bool_amount": {"amount_cents": True},
    "bad_direction": {"direction": "sideways"},
    "bad_date": {"posted_on": "2026-13-45"},
}


@pytest.mark.parametrize("name", list(BAD_ROWS))
def test_validate_vendor_row_rejects(name):
    """Trap 16: malformed rows yield a reason string, not a row."""
    result = validate_vendor_row({"id": "txn_000800", **good(**BAD_ROWS[name])})
    assert isinstance(result, str)


def test_validate_vendor_row_accepts_good():
    assert isinstance(validate_vendor_row({"id": "txn_000801", **good()}), dict)


def test_bad_rows_quarantined(db, fake):
    """Trap 16: malformed rows are quarantined, counted, and the sync continues."""
    for i, (_name, patch) in enumerate(BAD_ROWS.items()):
        fake.post({"id": f"txn_0009{i:02d}", **good(**patch)})
    run = run_sync(fake)
    assert run.status == "ok"
    assert run.rejected == len(BAD_ROWS)
    assert SyncRejection.objects.count() == len(BAD_ROWS)
    assert Transaction.objects.count() == 5  # only the five seed rows made it in
    assert not Transaction.objects.filter(pk__startswith="txn_0009").exists()


def test_put_during_sync_not_overwritten(db, fake):
    """Trap 7: a local PUT after the run started is not clobbered by an older page."""
    run_sync(fake)

    def local_put(page_no):
        Transaction.objects.filter(pk="txn_000004").update(
            category="travel", local_write_at=timezone.now()
        )

    fake.before_page = local_put
    run_sync(fake)
    assert Transaction.objects.get(pk="txn_000004").category == "travel"
    fake.before_page = None
    run_sync(fake)  # next full sync: vendor wins again (ADR 0019)
    assert Transaction.objects.get(pk="txn_000004").category is None


def test_pending_posts_with_new_date(db, fake):
    """Traps 2, 22: a pending row posts with a new amount and posted_on under the same id."""
    run_sync(fake)
    fake.set_pending_posted("txn_000004", 33000, "2026-11-02")
    run_sync(fake)
    t = Transaction.objects.get(pk="txn_000004")
    assert (t.amount_cents, str(t.posted_on), t.status) == (33000, "2026-11-02", "posted")
    assert Transaction.objects.count() == 5
    assert AuditEvent.objects.filter(txn_id="txn_000004", actor="sync").exists()


def test_vendor_down_fails_run_and_leaves_data(db, fake):
    """Trap 11: vendor down -> SyncRun failed, existing data untouched."""
    run_sync(fake)
    before = list(Transaction.objects.order_by("pk").values())
    fake.down = True
    run = run_sync(fake)
    assert run.status == "failed"
    assert list(Transaction.objects.order_by("pk").values()) == before
    assert SyncRun.objects.filter(status="failed").count() == 1


def test_idempotent_second_sync(db, fake):
    run_sync(fake)
    run = run_sync(fake)
    assert run.upserted == 0 and run.unchanged == 5
