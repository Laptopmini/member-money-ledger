"""HTTP API tests (Django test client). Vendor is always the fake."""

import pytest
from rest_framework.test import APIClient

from ledger.models import AuditEvent, Transaction


@pytest.fixture
def api(fresh_sync):
    return APIClient()


def assert_envelope(resp, status, code=None):
    assert resp.status_code == status, resp.content
    err = resp.json()["error"]
    assert set(err) >= {"code", "message", "request_id"}
    if code:
        assert err["code"] == code
    return err


def ids(resp):
    return [r["id"] for r in resp.json()["results"]]


# -- list ---------------------------------------------------------------------------------------
def test_list_order_and_shape(seed_db, api):
    body = api.get("/api/transactions").json()
    assert [r["id"] for r in body["results"]] == [
        "txn_000001",
        "txn_000002",
        "txn_000003",
        "txn_000005",
        "txn_000004",
    ]
    refund = next(r for r in body["results"] if r["id"] == "txn_000005")
    assert refund["kind"] == "refund" and refund["signed_cents"] == 2400
    assert body["next_cursor"] is None


def test_cursor_stable_on_ties(make_txn, api):
    """Trap 24: same-date rows page without skips or dups on (posted_on desc, id desc)."""
    for i in range(7):
        make_txn(id=f"txn_t{i}", posted_on="2026-10-14")
    make_txn(id="txn_older", posted_on="2026-10-13")
    seen, cursor = [], None
    for _ in range(10):
        url = "/api/transactions?limit=3" + (f"&cursor={cursor}" if cursor else "")
        body = api.get(url).json()
        seen += [r["id"] for r in body["results"]]
        cursor = body["next_cursor"]
        if cursor is None:
            break
    assert seen == [f"txn_t{i}" for i in range(6, -1, -1)] + ["txn_older"]


def test_filter_uncategorized(seed_db, api):
    assert ids(api.get("/api/transactions?category=uncategorized")) == ["txn_000004"]


def test_filter_category_and_status(seed_db, api):
    assert sorted(ids(api.get("/api/transactions?category=software"))) == [
        "txn_000003",
        "txn_000005",
    ]
    assert ids(api.get("/api/transactions?status=pending")) == ["txn_000004"]


def test_filter_dates_inclusive(seed_db, api):
    got = ids(api.get("/api/transactions?from=2026-10-14&to=2026-10-21"))
    assert sorted(got) == ["txn_000003", "txn_000004", "txn_000005"]


def test_filter_q_and_account(seed_db, api):
    assert ids(api.get("/api/transactions?q=figma")) == ["txn_000003", "txn_000005"]
    assert ids(api.get("/api/transactions?q=invoice")) == ["txn_000002"]
    assert sorted(ids(api.get("/api/transactions?account=acc_checking"))) == [
        "txn_000001",
        "txn_000002",
    ]


@pytest.mark.parametrize(
    "qs",
    [
        "from=2026-13-45",
        "from=nope",
        "to=2026-1-1",
        "status=weird",
        "limit=0",
        "limit=abc",
        "limit=9999",
        "cursor=%%%",
    ],
)
def test_list_invalid_params_400(seed_db, api, qs):
    assert_envelope(api.get(f"/api/transactions?{qs}"), 400)


def test_unknown_synced_category_accepted_on_read(make_txn, api):
    """Trap 3: unknown category from sync reads fine; label is the raw key."""
    make_txn(id="txn_000031", category="groceries")
    row = api.get("/api/transactions/txn_000031").json()
    assert row["category"] == "groceries"
    assert row["category_label"] == "groceries"
    assert row["category_known"] is False
    assert row["kind"] == "spend"


def test_get_detail_and_404(seed_db, api):
    assert api.get("/api/transactions/txn_000001").json()["merchant"] == "Blue Bottle Coffee"
    assert_envelope(api.get("/api/transactions/txn_999999"), 404, "not_found")


def test_categories(api):
    keys = [c["key"] for c in api.get("/api/categories").json()["results"]]
    assert {"income", "transfer", "meals", "software"} <= set(keys)


# -- patch --------------------------------------------------------------------------------------
def test_patch_happy_path_writes_audit(seed_db, fake, api):
    r = api.patch("/api/transactions/txn_000004", {"category": "travel"}, format="json")
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["category"] == "travel" and body["category_label"] == "Travel"
    assert fake.rows["txn_000004"]["category"] == "travel"
    assert Transaction.objects.get(pk="txn_000004").category == "travel"
    ev = AuditEvent.objects.get(txn_id="txn_000004")
    assert ev.action == "recategorize" and ev.before == {"category": None}
    assert ev.after == {"category": "travel"}
    hist = api.get("/api/transactions/txn_000004/history").json()["results"]
    assert hist[0]["action"] == "recategorize" and hist[0]["actor"] == "you"


def test_patch_rejects_unknown_category(seed_db, fake, api):
    """Trap 3: writes are validated against our list; the vendor is never called."""
    r = api.patch("/api/transactions/txn_000004", {"category": "nonsense"}, format="json")
    assert_envelope(r, 400, "invalid_category")
    assert fake.calls_named("update") == []
    assert Transaction.objects.get(pk="txn_000004").category is None


def test_patch_vendor_down_changes_nothing(seed_db, fake, api):
    """Trap 8: vendor down -> 502 friendly, no local change, no vendor text leaked."""
    fake.down = True
    r = api.patch("/api/transactions/txn_000004", {"category": "travel"}, format="json")
    err = assert_envelope(r, 502, "vendor_unavailable")
    assert "fake vendor down" not in err["message"]
    assert "Nothing was changed" in err["message"]
    assert Transaction.objects.get(pk="txn_000004").category is None
    assert AuditEvent.objects.count() == 0


def test_patch_stale_409(seed_db, fake, api):
    """Trap 13: a stale expected_updated_at is refused and the vendor is not called."""
    r = api.patch(
        "/api/transactions/txn_000004",
        {"category": "travel", "expected_updated_at": "2026-10-14T22:18:39Z"},  # 1s old
        format="json",
    )
    assert_envelope(r, 409, "stale")
    assert fake.calls_named("update") == []


def test_patch_matching_expected_updated_at_ok(seed_db, fake, api):
    r = api.patch(
        "/api/transactions/txn_000004",
        {"category": "travel", "expected_updated_at": "2026-10-14T22:18:40Z"},
        format="json",
    )
    assert r.status_code == 200, r.content


def test_patch_noop_skips_vendor(seed_db, fake, api):
    """Trap 28: same category -> no PUT (vendor would bump updated_at), no audit event."""
    r = api.patch("/api/transactions/txn_000001", {"category": "meals"}, format="json")
    assert r.status_code == 200
    assert fake.calls_named("update") == []
    assert AuditEvent.objects.count() == 0


@pytest.mark.parametrize("bad", ["..%2Fx", "txn_%C3%A9", "a b"])
def test_patch_bad_id_404_without_vendor(seed_db, fake, api, bad):
    """Trap 9: malformed ids 404 before any vendor call."""
    r = api.patch(f"/api/transactions/{bad}", {"category": "meals"}, format="json")
    assert_envelope(r, 404, "not_found")
    assert fake.calls == []


def test_patch_missing_body_400(seed_db, fake, api):
    assert_envelope(api.patch("/api/transactions/txn_000001", {}, format="json"), 400)
    assert fake.calls_named("update") == []


def test_patch_can_clear_category(seed_db, fake, api):
    r = api.patch("/api/transactions/txn_000001", {"category": None}, format="json")
    assert r.status_code == 200 and r.json()["category"] is None
    assert r.json()["category_label"] == "Uncategorized"


# -- summary ------------------------------------------------------------------------------------
@pytest.mark.parametrize("month", ["2026-1", "2026-13", "abc", "2026-00", "", "2026-10-01"])
def test_summary_invalid_month_400(api, month):
    assert_envelope(api.get(f"/api/summary?month={month}"), 400, "invalid_month")


def test_summary_empty_month_and_latest(seed_db, api):
    body = api.get("/api/summary?month=2026-11").json()
    assert body["income_cents"] == 0 and body["by_category"] == []
    assert body["latest_month_with_data"] == "2026-10"


def test_summary_etag_changes_on_recategorize(seed_db, fake, api):
    """Trap 19: ETag is keyed by a data version; a recategorize invalidates it; 304 otherwise."""
    first = api.get("/api/summary?month=2026-10")
    etag = first["ETag"]
    assert "private" in first["Cache-Control"]
    again = api.get("/api/summary?month=2026-10", HTTP_IF_NONE_MATCH=etag)
    assert again.status_code == 304
    api.patch("/api/transactions/txn_000004", {"category": "travel"}, format="json")
    changed = api.get("/api/summary?month=2026-10", HTTP_IF_NONE_MATCH=etag)
    assert changed.status_code == 200
    assert changed["ETag"] != etag
    assert changed.json()["uncategorized_count"] == 0


# -- sync / health ------------------------------------------------------------------------------
def test_post_sync_and_status(db, fake):
    api = APIClient()
    assert api.get("/api/sync/status").json()["state"] == "never"
    r = api.post("/api/sync", {}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["upserted"] == 5
    st = api.get("/api/sync/status").json()
    assert st["state"] == "ok" and st["rejected_count"] == 0


def test_post_sync_vendor_down(db, fake):
    """Trap 11: vendor down -> 502, status shows vendor_down, data stays readable."""
    api = APIClient()
    api.post("/api/sync", {}, format="json")
    fake.down = True
    r = api.post("/api/sync", {}, format="json")
    assert_envelope(r, 502, "vendor_unavailable")
    assert api.get("/api/sync/status").json()["state"] == "vendor_down"
    assert Transaction.objects.count() == 5


def test_health_ok(db, fake):
    body = APIClient().get("/api/health").json()
    assert body == {"status": "ok", "db": "ok", "vendor": "ok"}


def test_health_vendor_down(db, fake):
    """Trap 27: health reports degraded with 200, never a 500."""
    fake.down = True
    r = APIClient().get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "degraded" and r.json()["vendor"] == "down"


def test_unknown_route_uses_envelope(db):
    assert_envelope(APIClient().get("/api/nope"), 404, "not_found")
