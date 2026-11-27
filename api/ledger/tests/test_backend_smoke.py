import pytest
from django.test import Client

from ledger.categories import CATEGORIES, is_valid_category, label_for
from ledger.demo import demo_payloads
from ledger.money import classify, signed_cents
from ledger.sync import validate_vendor_row
from ledger.vendor import InvalidTransactionId, validate_txn_id

GOOD = {
    "id": "txn_1",
    "account_id": "acc_card",
    "posted_on": "2026-10-01",
    "amount_cents": 100,
    "direction": "debit",
    "currency": "USD",
    "merchant": "X",
    "category": None,
    "description": None,
    "status": "posted",
    "updated_at": "2026-10-01T00:00:00Z",
}


def test_signed_and_classify() -> None:
    assert signed_cents(5, "debit") == -5 and signed_cents(5, "credit") == 5
    assert classify("software", "credit", "USD") == "refund"
    assert classify(None, "credit", "USD") == "uncategorized_credit"
    assert classify(None, "debit", "USD") == "spend"
    assert classify("income", "debit", "USD") == "income"
    assert classify("meals", "debit", "EUR") == "excluded_currency"
    assert classify("transfer", "debit", "USD") == "transfer"


def test_categories() -> None:
    assert len(CATEGORIES) == 16 and is_valid_category("meals")
    assert label_for(None) == "Uncategorized" and label_for("groceries") == "groceries"


@pytest.mark.parametrize(
    "patch",
    [
        {"amount_cents": 1.5},
        {"amount_cents": True},
        {"amount_cents": -1},
        {"direction": "sideways"},
        {"posted_on": "2026-02-30"},
        {"currency": "usd"},
        {"id": "a/b"},
    ],
)
def test_validator_rejects(patch: dict[str, object]) -> None:
    assert isinstance(validate_vendor_row({**GOOD, **patch}), str)


def test_validator_accepts() -> None:
    row = validate_vendor_row(GOOD)
    assert isinstance(row, dict) and row["description"] == ""


def test_id_regex() -> None:
    assert validate_txn_id("txn_000001") == "txn_000001"
    for bad in ("../x", "a b", "", "x" * 65, "é"):
        with pytest.raises(InvalidTransactionId):
            validate_txn_id(bad)


def test_demo_rows_valid() -> None:
    assert len(demo_payloads()) >= 55


@pytest.mark.django_db
def test_error_envelope_everywhere() -> None:
    c = Client()
    for method, url, status in [
        ("get", "/api/nope", 404),
        ("delete", "/api/categories", 405),
        ("get", "/api/summary?month=2026-13", 400),
        ("get", "/api/transactions/bad%20id", 404),
        ("get", "/api/transactions?cursor=zzz", 400),
    ]:
        r = getattr(c, method)(url)
        assert r.status_code == status
        body = r.json()["error"]
        assert {"code", "message", "request_id"} <= body.keys()
