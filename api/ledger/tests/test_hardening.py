"""Second-round (reviewer) traps N1-N7, throttles, logging, locks, demo rows."""

import logging

import pytest
from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from ledger.models import AuditEvent, SyncRejection, Transaction
from ledger.sync import ADVISORY_LOCK_KEY, run_sync, sync_with_lock, validate_vendor_row
from ledger.tests.conftest import dt
from ledger.tests.fake_vendor import FakeLedgerly
from ledger.tests.test_api import assert_envelope
from ledger.tests.test_sync import good


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api(fresh_sync):
    return APIClient()


# -- N1 -----------------------------------------------------------------------------------------
@pytest.mark.parametrize(
    "patch",
    [
        {"merchant": "m" * 256},
        {"account_id": "a" * 65},
        {"category": "c" * 65},
        {"amount_cents": 2**63},
        {"merchant": "a\x00b"},
        {"description": "a\x00b"},
    ],
    ids=["merchant256", "account65", "category65", "amount2^63", "nul_merchant", "nul_description"],
)
def test_oversize_and_nul_fields_quarantined(db, fake, patch):
    """N1: values Postgres can't store are quarantined, not a crashed sync."""
    fake.post({"id": "txn_000950", **good(**patch)})
    run = run_sync(fake)
    assert run.status == "ok"
    assert SyncRejection.objects.filter(txn_id="txn_000950").exists()
    assert not Transaction.objects.filter(pk="txn_000950").exists()


# -- N7 -----------------------------------------------------------------------------------------
class JunkPageFake(FakeLedgerly):
    def list_page(self, cursor=None):
        rows, nxt = super().list_page(cursor)
        return [*rows, None, 5, "str", ["x"]], nxt


def test_none_and_non_dict_rows_in_page(db):
    """N7: junk entries in a page are quarantined; the sync is ok every time."""
    f = JunkPageFake()
    for _ in range(2):
        assert run_sync(f).status == "ok"  # type: ignore[arg-type]
    assert Transaction.objects.count() == 5
    assert SyncRejection.objects.count() >= 1


# -- N2 -----------------------------------------------------------------------------------------
def test_patch_between_select_and_save_survives_sync(db, fake, monkeypatch):
    """N2: a member PATCH landing after the sync loaded the row and before it saves wins."""
    import ledger.sync as sync_mod

    run_sync(fake)
    fake.rows["txn_000004"]["category"] = "other"  # vendor differs so sync wants to write
    fake.rows["txn_000004"]["updated_at"] = "2026-11-01T00:00:00Z"
    original = sync_mod.apply_row

    def racing(clean, existing, run, now):
        if clean["id"] == "txn_000004":
            Transaction.objects.filter(pk="txn_000004").update(
                category="travel", local_write_at=timezone.now()
            )
        return original(clean, existing, run, now)

    monkeypatch.setattr(sync_mod, "apply_row", racing)
    assert run_sync(fake).status == "ok"
    assert Transaction.objects.get(pk="txn_000004").category == "travel"


# -- N3 -----------------------------------------------------------------------------------------
@pytest.mark.xfail(strict=False, reason="vendor 1-second resolution; documented limitation")
def test_two_patches_same_expected_same_second(db, fake, api):
    """N3: the second PATCH with the same expected_updated_at should be stale (409)."""
    stamp = "2026-11-27T10:00:00Z"
    fake.clock = lambda: stamp
    fake.rows["txn_000004"]["updated_at"] = stamp
    Transaction.objects.create(
        **{
            **{k: v for k, v in fake.rows["txn_000004"].items() if k != "updated_at"},
            "vendor_updated_at": dt(stamp),
        }
    )
    body = {"category": "travel", "expected_updated_at": stamp}
    assert api.patch("/api/transactions/txn_000004", body, format="json").status_code == 200
    body2 = {"category": "meals", "expected_updated_at": stamp}
    assert api.patch("/api/transactions/txn_000004", body2, format="json").status_code == 409


def test_patch_409_when_vendor_row_changed_since_sync(seed_db, fake, api):
    """N3: backend GETs before the PUT; a vendor row newer than our mirror gives 409."""
    fake.rows["txn_000004"]["updated_at"] = "2026-11-02T08:00:00Z"
    r = api.patch(
        "/api/transactions/txn_000004",
        {"category": "travel", "expected_updated_at": "2026-10-14T22:18:40Z"},
        format="json",
    )
    assert_envelope(r, 409, "stale")
    assert fake.calls_named("update") == []
    assert Transaction.objects.get(pk="txn_000004").category is None


# -- N4 -----------------------------------------------------------------------------------------
def test_pending_transfer_refund_income(make_txn, api):
    """N4: pending transfer adds 0; pending refund nets; pending income reported separately."""
    make_txn(status="pending", category="travel", amount_cents=1000)
    make_txn(status="pending", category="travel", direction="credit", amount_cents=400)
    make_txn(status="pending", category="transfer", amount_cents=5000)
    make_txn(status="pending", category="income", direction="credit", amount_cents=7000)
    data = api.get("/api/summary?month=2026-10").json()
    assert data["pending_cents"] == 600
    assert data["pending_income_cents"] == 7000
    assert data["spend_cents"] == 0 and data["income_cents"] == 0


# -- N5 -----------------------------------------------------------------------------------------
def test_etag_changes_when_synced_at_changes(db, fake):
    """N5: a no-change sync still moves synced_at, so the cached summary must not 304."""
    api = APIClient()
    run_sync(fake)
    first = api.get("/api/summary?month=2026-10")
    run_sync(fake)
    second = api.get("/api/summary?month=2026-10", HTTP_IF_NONE_MATCH=first["ETag"])
    assert second.status_code == 200
    assert second["ETag"] != first["ETag"]


# -- N6 -----------------------------------------------------------------------------------------
class EmptyPageFake(FakeLedgerly):
    """Page 1 has rows, page 2 is empty but still hands back a cursor (untrustworthy list)."""

    def list_page(self, cursor=None):
        self._check("list_page", cursor)
        if not cursor:
            return [dict(r) for r in self._sorted()[:2]], "2"
        return [], "4"


def test_empty_page_with_cursor_means_no_tombstones(db, make_txn):
    """N6: a truncated listing must not tombstone 200 local rows (no per-row GETs either)."""
    f = EmptyPageFake()
    for i in range(200):
        make_txn(id=f"txn_l{i:03d}")
    run = run_sync(f)  # type: ignore[arg-type]
    assert run.status == "ok"
    assert f.calls_named("get") == []
    assert Transaction.objects.visible().count() >= 200


def test_candidate_get_unavailable_keeps_row(db, fake, make_txn):
    """N6: a GET failing with VendorUnavailable keeps the row; the run stays ok."""
    from ledger.vendor import VendorUnavailable

    run_sync(fake)
    make_txn(id="txn_local1")
    real_get = fake.get

    def flaky(txn_id):
        if txn_id == "txn_local1":
            raise VendorUnavailable("boom")
        return real_get(txn_id)

    fake.get = flaky
    run = run_sync(fake)
    assert run.status == "ok"
    assert Transaction.objects.get(pk="txn_local1").deleted_at is None


# -- Trap 15 audit ------------------------------------------------------------------------------
def test_reused_id_writes_replaced_audit_and_history_resets(db, fake, api):
    """Trap 15: reused id -> 'replaced' event; history shows only events from it onward."""
    run_sync(fake)
    api.patch("/api/transactions/txn_000001", {"category": "travel"}, format="json")
    fake.restart()
    fake.rows["txn_000001"].update(
        merchant="Someone Else", amount_cents=999, posted_on="2026-10-27"
    )
    run_sync(fake)
    assert AuditEvent.objects.filter(txn_id="txn_000001", action="replaced").exists()
    hist = api.get("/api/transactions/txn_000001/history").json()["results"]
    actions = [e["action"] for e in hist]
    assert "replaced" in actions
    assert "recategorize" not in actions


# -- throttles / content type -------------------------------------------------------------------
def test_sync_throttle_seventh_is_429(db, fake):
    """7th POST /api/sync within a minute is throttled with the envelope."""
    api = APIClient()
    codes = [api.post("/api/sync", {}, format="json").status_code for _ in range(6)]
    assert 429 not in codes
    assert_envelope(api.post("/api/sync", {}, format="json"), 429, "throttled")


def test_text_plain_is_415(seed_db, fake, api):
    r = api.patch("/api/transactions/txn_000001", "category=meals", content_type="text/plain")
    assert_envelope(r, 415, "unsupported_media_type")
    r2 = APIClient().post("/api/sync", "x", content_type="text/plain")
    assert r2.status_code == 415


# -- logging ------------------------------------------------------------------------------------
def test_server_log_has_no_query_text(caplog):
    """Trap 17: the runserver access log never carries merchant text from ?q=."""
    from django.core.servers.basehttp import WSGIRequestHandler

    h = WSGIRequestHandler.__new__(WSGIRequestHandler)
    h.client_address = ("127.0.0.1", 1234)
    h.request = None  # type: ignore[assignment]
    with caplog.at_level(logging.DEBUG):
        h.log_message('"%s" %s %s', "GET /api/transactions?q=Figma HTTP/1.1", "200", "1234")
    assert caplog.records, "django.server emitted nothing"
    assert all("Figma" not in r.getMessage() for r in caplog.records)


# -- lock ---------------------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_sync_with_lock_respects_other_holder_and_releases(fake):
    """A held advisory lock makes sync_with_lock return None; a normal run releases it."""
    other = connection.copy()
    try:
        with other.cursor() as cur:
            cur.execute("SELECT pg_try_advisory_lock(%s)", [ADVISORY_LOCK_KEY])
            assert cur.fetchone()[0] is True
            assert sync_with_lock(fake) is None
            cur.execute("SELECT pg_advisory_unlock(%s)", [ADVISORY_LOCK_KEY])
        run = sync_with_lock(fake)
        assert run is not None and run.status == "ok"
        with other.cursor() as cur:  # released after the run
            cur.execute("SELECT pg_try_advisory_lock(%s)", [ADVISORY_LOCK_KEY])
            assert cur.fetchone()[0] is True
            cur.execute("SELECT pg_advisory_unlock(%s)", [ADVISORY_LOCK_KEY])
    finally:
        other.close()


# -- Trap 10 ------------------------------------------------------------------------------------
def test_demo_rows_valid():
    """Trap 10: every demo row passes the same validator the sync uses."""
    from ledger.demo import demo_payloads

    payloads = demo_payloads()
    assert payloads
    for body in payloads:
        probe = {
            **body,
            "id": "txn_demo",
            "currency": "USD",
            "status": "posted",
            "updated_at": "2026-11-27T00:00:00Z",
        }
        assert isinstance(validate_vendor_row(probe), dict), body
