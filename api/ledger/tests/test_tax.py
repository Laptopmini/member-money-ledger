from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from ledger import flags, tax
from ledger.models import AuditEvent, SetAsideMark, Transaction


def row(category, direction, total, status="posted", currency="USD", n=1):
    return {
        "category": category,
        "direction": direction,
        "total": total,
        "status": status,
        "currency": currency,
        "n": n,
    }


def compute(rows, rate="0.25", marked=0, q="2026-Q4"):
    return tax.compute_set_aside(
        rows,
        rate=Decimal(rate),
        set_aside_cents=marked,
        the_period=tax.parse_quarter(q),
        today=date(2026, 11, 27),
    )


@pytest.mark.parametrize(
    ("day", "label", "due"),
    [
        (date(2026, 1, 1), "2026-Q1", date(2026, 4, 15)),
        (date(2026, 3, 31), "2026-Q1", date(2026, 4, 15)),
        (date(2026, 4, 1), "2026-Q2", date(2026, 6, 15)),
        (date(2026, 5, 31), "2026-Q2", date(2026, 6, 15)),
        (date(2026, 6, 1), "2026-Q3", date(2026, 9, 15)),
        (date(2026, 8, 31), "2026-Q3", date(2026, 9, 15)),
        (date(2026, 9, 1), "2026-Q4", date(2027, 1, 15)),
        (date(2026, 12, 31), "2026-Q4", date(2027, 1, 15)),
    ],
)
def test_periods(day, label, due):
    p = tax.period_for(day)
    assert p.label == label and p.due_on == due and p.start <= day <= p.end


def test_parse_quarter():
    assert tax.parse_quarter("2026-Q4").end == date(2026, 12, 31)
    for bad in ("2026-Q5", "2026Q4", "26-Q1", "", "2026-q1"):
        with pytest.raises(ValueError):
            tax.parse_quarter(bad)


def test_meals_half():
    out = compute([row("income", "credit", 100000), row("meals", "debit", 4599)])
    assert out["deductible_cents"] == 2300  # 2299.5 rounds half up
    assert out["profit_cents"] == 97700 and out["estimate_cents"] == 24425


def test_refund_netting_and_negative_clamp():
    out = compute(
        [
            row("income", "credit", 100000),
            row("software", "debit", 2400),
            row("software", "credit", 2400),
            row("travel", "credit", 5000),  # net negative: clamped, never adds income
        ]
    )
    assert out["deductible_cents"] == 0 and out["profit_cents"] == 100000


def test_personal_unknown_uncategorized_count_zero():
    out = compute(
        [
            row("income", "credit", 100000),
            row("personal", "debit", 5000),
            row("groceries", "debit", 5000),
            row(None, "debit", 5000),
            row("transfer", "debit", 5000),
        ]
    )
    assert out["deductible_cents"] == 0


def test_uncategorized_reduction_includes_pending():
    out = compute(
        [row("income", "credit", 850000), row(None, "debit", 31275, status="pending", n=1)]
    )
    assert out["uncategorized_debit_count"] == 1
    assert out["uncategorized_debit_cents"] == 31275
    assert out["potential_reduction_cents"] == 7819


def test_chargeback_nets_income_and_non_usd_ignored():
    out = compute(
        [
            row("income", "credit", 10000),
            row("income", "debit", 4000),
            row("meals", "debit", 99, currency="EUR"),
        ]
    )
    assert out["income_cents"] == 6000 and out["deductible_cents"] == 0


def test_status_values():
    assert compute([])["status"] == "no_income"
    assert compute([row("income", "credit", 100000)])["status"] == "behind"
    assert compute([row("income", "credit", 100000)], marked=25000)["status"] == "on_track"


def test_days_until_due_and_example_shape():
    out = compute([row("income", "credit", 850000), row("meals", "debit", 4599)])
    assert out["days_until_due"] == 49
    assert out["estimate_cents"] == 211925 and out["gap_cents"] == 211925


def mk(**kw):
    base = dict(
        account_id="a",
        posted_on=date(2026, 10, 1),
        amount_cents=1,
        direction="debit",
        currency="USD",
        merchant="m",
        description="",
        category=None,
        status="posted",
        vendor_updated_at=timezone.now(),
    )
    base.update(kw)
    return Transaction.objects.create(**base)


@pytest.mark.django_db
def test_endpoint_marks_accumulate_and_flip_status():
    mk(id="t1", amount_cents=800000, direction="credit", category="income")
    api = APIClient()
    r = api.get("/api/tax/set-aside?quarter=2026-Q4&today=2026-11-27")
    assert r.status_code == 200 and r.json()["status"] == "behind"
    assert r.json()["estimate_cents"] == 200000 and r.json()["days_until_due"] == 49
    r = api.post(
        "/api/tax/set-aside-marks", {"quarter": "2026-Q4", "amount_cents": 150000}, format="json"
    )
    assert r.status_code == 201 and r.json()["set_aside_cents"] == 150000
    r = api.post(
        "/api/tax/set-aside-marks", {"quarter": "2026-Q4", "amount_cents": 50000}, format="json"
    )
    assert r.json()["set_aside_cents"] == 200000
    r = api.get("/api/tax/set-aside?quarter=2026-Q4")
    assert r.json()["status"] == "on_track" and r.json()["gap_cents"] == 0
    assert SetAsideMark.objects.count() == 2
    assert AuditEvent.objects.filter(action="set_aside_marked").count() == 2


@pytest.mark.django_db
def test_endpoint_validation():
    api = APIClient()
    for body in (
        {"quarter": "2026-Q9", "amount_cents": 5},
        {"quarter": "2026-Q4", "amount_cents": 0},
    ):
        assert api.post("/api/tax/set-aside-marks", body, format="json").status_code == 400
    assert api.get("/api/tax/set-aside?quarter=nope").status_code == 400
    assert api.get("/api/tax/set-aside?today=2026-13-40").status_code == 400


@pytest.mark.django_db
def test_rate_bounds():
    api = APIClient()
    for bad in (-0.01, 0.61, "abc", None):
        r = api.put("/api/tax/settings", {"rate": bad}, format="json")
        assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_rate"
    assert api.put("/api/tax/settings", {"rate": 0.3}, format="json").json() == {"rate": 0.3}
    mk(id="t1", amount_cents=100000, direction="credit", category="income")
    assert api.get("/api/tax/set-aside?quarter=2026-Q4").json()["estimate_cents"] == 30000


@pytest.mark.django_db
def test_flag_off_is_404():
    flags.TEST_OVERRIDES = {"auth-required": False, "tax-set-aside": False}
    api = APIClient()
    for r in (
        api.get("/api/tax/set-aside"),
        api.put("/api/tax/settings", {"rate": 0.3}, format="json"),
        api.post(
            "/api/tax/set-aside-marks", {"quarter": "2026-Q4", "amount_cents": 5}, format="json"
        ),
    ):
        assert r.status_code == 404 and r.json()["error"]["code"] == "feature_disabled"
