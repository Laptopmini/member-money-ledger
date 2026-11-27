import pytest
from rest_framework.test import APIClient

from ledger import flags
from ledger.models import AuditEvent, MerchantRule, Transaction
from ledger.rules import normalize_merchant
from ledger.sync import run_sync
from ledger.tests.fake_vendor import FakeLedgerly


@pytest.fixture(autouse=True)
def _rules_on(monkeypatch):
    flags.TEST_OVERRIDES = {"auth-required": False, "merchant-rules": True}


@pytest.fixture
def vendor(monkeypatch):
    f = FakeLedgerly()
    for target in ("ledger.vendor", "ledger.sync", "ledger.views", "ledger.rules"):
        monkeypatch.setattr(f"{target}.LedgerlyClient", lambda *a, **k: f, raising=False)
    return f


def vrow(i, merchant, category=None, **kw):
    base = {
        "id": f"txn_r{i:03d}",
        "account_id": "acc_card",
        "posted_on": "2026-10-10",
        "amount_cents": 2400,
        "direction": "debit",
        "currency": "USD",
        "merchant": merchant,
        "category": category,
        "description": "",
        "status": "posted",
        "updated_at": "2026-10-10T12:00:00Z",
    }
    base.update(kw)
    return base


def test_normalize():
    assert normalize_merchant("  FIGMA \t Inc ") == "figma inc"
    assert normalize_merchant("Figma") == normalize_merchant("figma ")


def test_preview_counts_only_uncategorized(db, make_txn):
    make_txn(merchant="Figma", category=None)
    make_txn(merchant=" figma ", category=None)
    make_txn(merchant="Figma", category="software")
    make_txn(merchant="Figmaz", category=None)
    r = APIClient().get("/api/rules/preview?merchant=FIGMA&category=software")
    assert r.status_code == 200 and r.json()["matching_uncategorized_count"] == 2
    assert APIClient().get("/api/rules/preview?merchant=x&category=nope").status_code == 400


def test_post_applies_audits_and_never_overwrites(db, vendor):
    for i, (m, c) in enumerate([("Figma", None), ("figma", None), ("Figma", "travel")]):
        vendor.post(vrow(i, m, c))
    run_sync(vendor)
    r = APIClient().post("/api/rules", {"merchant": "Figma", "category": "software"}, format="json")
    assert r.status_code == 201 and r.json()["applied_count"] == 2
    cats = dict(Transaction.objects.filter(pk__startswith="txn_r").values_list("pk", "category"))
    assert cats == {"txn_r000": "software", "txn_r001": "software", "txn_r002": "travel"}
    ev = AuditEvent.objects.filter(action="rule_applied")
    assert ev.count() == 2 and {e.actor for e in ev} == {"rule"}
    # idempotent update of the same rule
    r = APIClient().post("/api/rules", {"merchant": " FIGMA", "category": "other"}, format="json")
    assert r.json()["applied_count"] == 0 and MerchantRule.objects.count() == 1
    assert len(APIClient().get("/api/rules").json()["results"]) == 1


def test_delete_rule(db):
    api = APIClient()
    rid = api.post("/api/rules", {"merchant": "A", "category": "meals"}, format="json").json()[
        "rule"
    ]["id"]
    assert api.delete(f"/api/rules/{rid}", {}, format="json").status_code == 204
    assert api.delete(f"/api/rules/{rid}", {}, format="json").status_code == 404


def test_flag_off_is_404(db):
    flags.TEST_OVERRIDES = {"auth-required": False, "merchant-rules": False}
    api = APIClient()
    for r in (
        api.get("/api/rules"),
        api.get("/api/rules/preview?merchant=a&category=meals"),
        api.post("/api/rules", {"merchant": "a", "category": "meals"}, format="json"),
        api.delete("/api/rules/1", {}, format="json"),
    ):
        assert r.status_code == 404 and r.json()["error"]["code"] == "feature_disabled"


def test_sync_applies_rule_to_new_uncategorized_row(db, vendor):
    api = APIClient()
    api.post("/api/rules", {"merchant": "Adobe", "category": "software"}, format="json")
    vendor.post(vrow(1, "ADOBE"))
    vendor.post(vrow(2, "Adobe", "travel"))
    run = run_sync(vendor)
    assert run.status == "ok"
    assert Transaction.objects.get(pk="txn_r001").category == "software"
    assert Transaction.objects.get(pk="txn_r002").category == "travel"
    assert vendor.rows["txn_r001"]["category"] == "software"  # written through to the vendor
