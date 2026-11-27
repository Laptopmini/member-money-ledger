"""Money rules. Cents are ints; one signed_cents(); kinds per ADR rules 1,2,3,5,12,23.

Summary numbers are checked through the API (`/api/summary`) since that is the public contract.
"""

import pytest
from rest_framework.test import APIClient

from ledger.categories import label_for
from ledger.money import classify, signed_cents


@pytest.fixture
def api(fresh_sync):
    return APIClient()


def summary(api, month="2026-10"):
    r = api.get(f"/api/summary?month={month}")
    assert r.status_code == 200, r.content
    return r.json()


def test_signed_cents_only_sign_source():
    assert signed_cents(100, "credit") == 100
    assert signed_cents(100, "debit") == -100
    with pytest.raises(ValueError):
        signed_cents(100, "sideways")


@pytest.mark.parametrize(
    ("cat", "direction", "currency", "kind"),
    [
        ("software", "credit", "USD", "refund"),
        ("software", "debit", "USD", "spend"),
        ("income", "credit", "USD", "income"),
        ("income", "debit", "USD", "income"),  # trap 23: chargeback, negative sign
        (None, "credit", "USD", "uncategorized_credit"),
        (None, "debit", "USD", "spend"),
        ("transfer", "debit", "USD", "transfer"),
        ("transfer", "credit", "USD", "transfer"),
        ("meals", "debit", "EUR", "excluded_currency"),
        ("income", "credit", "CAD", "excluded_currency"),
    ],
)
def test_classify_kinds(cat, direction, currency, kind):
    """Traps 1, 3, 5, 12, 23: row kinds."""
    assert classify(cat, direction, currency) == kind


def test_unknown_category_label_is_raw_key():
    """Trap 3: unknown synced category is accepted on read; label = raw key."""
    assert label_for("groceries") == "groceries"
    assert label_for(None) == "Uncategorized"


def test_refund_nets_category(seed_db, api):
    """Trap 1: the Figma refund nets against software; it is not income."""
    data = summary(api)
    software = next(c for c in data["by_category"] if c["category"] == "software")
    assert software["count"] == 2
    assert software["spend_cents"] == 0  # 2400 charge - 2400 refund
    assert data["income_cents"] == 850000  # refund not counted as income


def test_seed_summary_numbers(seed_db, api):
    """Traps 1,2,3: the seed month's headline numbers."""
    data = summary(api)
    assert data["income_cents"] == 850000
    assert data["spend_cents"] == 4599
    assert data["net_cents"] == 845401
    assert data["pending_cents"] == 31275
    assert data["pending_count"] == 1
    assert data["uncategorized_count"] == 1


def test_pending_excluded(make_txn, api):
    """Trap 2: pending rows never count in totals; reported as pending_cents."""
    make_txn(status="pending", amount_cents=5000, category="travel")
    data = summary(api)
    assert data["spend_cents"] == 0
    assert data["pending_cents"] == 5000
    assert data["pending_count"] == 1


def test_uncategorized_bucket(make_txn, api):
    """Trap 3: category=None is a first-class bucket; count includes pending rows."""
    make_txn(category=None, status="pending", amount_cents=700)
    make_txn(category=None, status="posted", amount_cents=300)
    data = summary(api)
    assert data["uncategorized_count"] == 2


def test_uncategorized_credit_not_income(make_txn, api):
    """Trap 1: an uncategorized credit is not income; counted and flagged separately."""
    make_txn(category=None, direction="credit", amount_cents=12345)
    data = summary(api)
    assert data["income_cents"] == 0
    assert data["uncategorized_credit_cents"] == 12345
    assert data["uncategorized_credit_count"] == 1


def test_month_boundaries(make_txn, api):
    """Trap 4: month is the YYYY-MM prefix of the local date; no timezone shift."""
    make_txn(posted_on="2026-10-01", amount_cents=100, category="meals")
    make_txn(posted_on="2026-10-31", amount_cents=200, category="meals")
    make_txn(posted_on="2026-11-01", amount_cents=400, category="meals")
    make_txn(posted_on="2026-09-30", amount_cents=800, category="meals")
    assert summary(api, "2026-10")["spend_cents"] == 300
    assert summary(api, "2026-11")["spend_cents"] == 400
    assert summary(api, "2026-09")["spend_cents"] == 800


def test_december_to_january_rollover(make_txn, api):
    """Trap 4: Dec 31 stays in December, Jan 1 in January."""
    make_txn(posted_on="2026-12-31", amount_cents=100, category="meals")
    make_txn(posted_on="2027-01-01", amount_cents=200, category="meals")
    assert summary(api, "2026-12")["spend_cents"] == 100
    assert summary(api, "2027-01")["spend_cents"] == 200


def test_non_usd_excluded(make_txn, api):
    """Trap 5: non-USD rows are excluded from totals and counted."""
    make_txn(currency="EUR", amount_cents=99999, category="meals")
    make_txn(currency="EUR", direction="credit", amount_cents=88888, category="income")
    data = summary(api)
    assert data["spend_cents"] == 0
    assert data["income_cents"] == 0
    assert data["excluded_currency_count"] == 2


def test_transfer_excluded(make_txn, api):
    """Trap 12: transfers are in neither spend nor income."""
    make_txn(category="transfer", direction="debit", amount_cents=50000)
    make_txn(category="transfer", direction="credit", amount_cents=50000)
    data = summary(api)
    assert data["spend_cents"] == 0
    assert data["income_cents"] == 0
    assert data["net_cents"] == 0


def test_negative_category(make_txn, api):
    """Trap 23: a refund in a different month than the charge makes a category net negative."""
    make_txn(posted_on="2026-11-03", direction="credit", category="software", amount_cents=2400)
    data = summary(api, "2026-11")
    software = next(c for c in data["by_category"] if c["category"] == "software")
    assert software["spend_cents"] == -2400
    assert data["income_cents"] == 0


def test_income_debit_nets(make_txn, api):
    """Trap 23: a debit in `income` is a chargeback and nets against income."""
    make_txn(category="income", direction="credit", amount_cents=100000)
    make_txn(category="income", direction="debit", amount_cents=30000)
    data = summary(api)
    assert data["income_cents"] == 70000
    assert data["spend_cents"] == 0
