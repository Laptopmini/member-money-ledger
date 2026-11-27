"""Quarterly tax set-aside. Pure functions: int cents in and out, Decimal inside (ADR 0012)."""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from .categories import CATEGORIES
from .money import classify, signed_cents

QUARTER_RE = re.compile(r"\A(\d{4})-Q([1-4])\Z")
DEFAULT_RATE = Decimal("0.25")
MAX_RATE = Decimal("0.6")
DISCLAIMER = "An estimate, not tax advice."

# IRS periods are not calendar quarters: (first month, last month, due month, due day, due year +)
_PERIODS = {1: (1, 3, 4, 15, 0), 2: (4, 5, 6, 15, 0), 3: (6, 8, 9, 15, 0), 4: (9, 12, 1, 15, 1)}


@dataclass(frozen=True)
class Period:
    year: int
    number: int
    start: date
    end: date
    due_on: date

    @property
    def label(self) -> str:
        return f"{self.year}-Q{self.number}"


def _last_day(year: int, month: int) -> date:
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    return date.fromordinal(nxt.toordinal() - 1)


def period(year: int, number: int) -> Period:
    first, last, due_m, due_d, due_plus = _PERIODS[number]
    return Period(
        year=year,
        number=number,
        start=date(year, first, 1),
        end=_last_day(year, last),
        due_on=date(year + due_plus, due_m, due_d),
    )


def period_for(day: date) -> Period:
    for number, (first, last, *_rest) in _PERIODS.items():
        if first <= day.month <= last:
            return period(day.year, number)
    raise AssertionError("unreachable")  # pragma: no cover


def parse_quarter(value: str) -> Period:
    m = QUARTER_RE.match(value)
    if not m:
        raise ValueError("quarter must look like 2026-Q4")
    return period(int(m.group(1)), int(m.group(2)))


def round_half_up(value: Decimal) -> int:
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def valid_rate(rate: Decimal) -> bool:
    return Decimal(0) <= rate <= MAX_RATE


def compute_set_aside(
    rows: Iterable[dict[str, Any]],
    *,
    rate: Decimal,
    set_aside_cents: int,
    the_period: Period,
    today: date,
) -> dict[str, Any]:
    """`rows` are grouped aggregates over the period: category, status, currency, direction,
    total (sum of positive cents) and n. Non-USD rows are ignored everywhere."""
    income = 0
    net_by_cat: dict[str, int] = {}
    unc_n = unc_cents = 0
    for r in rows:
        if r["currency"] != "USD":
            continue
        cat, direction, total, n = r["category"], r["direction"], int(r["total"]), r["n"]
        if cat is None and direction == "debit":
            unc_n += n  # pending included: it will post
            unc_cents += total
        if r["status"] != "posted":
            continue
        kind = classify(cat, direction, r["currency"])
        signed = signed_cents(total, direction)
        if kind == "income":
            income += signed  # a chargeback (debit in income) nets against it
        elif kind in ("spend", "refund") and cat is not None:
            net_by_cat[cat] = net_by_cat.get(cat, 0) - signed

    deductible = Decimal(0)
    for cat, net in net_by_cat.items():
        known = CATEGORIES.get(cat)
        if known is None or known.kind != "expense":
            continue  # unknown synced categories and personal count 0
        deductible += Decimal(max(0, net)) * known.deductible_fraction
    deductible_cents = round_half_up(deductible)

    profit = max(0, income - deductible_cents)
    estimate = round_half_up(Decimal(profit) * rate)
    gap = max(0, estimate - set_aside_cents)
    if income == 0:
        status = "no_income"
    elif gap == 0:
        status = "on_track"
    else:
        status = "behind"
    return {
        "quarter": the_period.label,
        "period_start": the_period.start.isoformat(),
        "period_end": the_period.end.isoformat(),
        "due_on": the_period.due_on.isoformat(),
        "days_until_due": (the_period.due_on - today).days,
        "rate": float(rate),
        "income_cents": income,
        "deductible_cents": deductible_cents,
        "profit_cents": profit,
        "estimate_cents": estimate,
        "set_aside_cents": set_aside_cents,
        "gap_cents": gap,
        "status": status,
        "uncategorized_debit_count": unc_n,
        "uncategorized_debit_cents": unc_cents,
        # "about": assumes the uncategorized debits are fully deductible
        "potential_reduction_cents": round_half_up(Decimal(unc_cents) * rate),
        "disclaimer": DISCLAIMER,
    }
