"""Money rules. Cents are integers; the sign is applied in exactly one place."""

from typing import Literal

RowKind = Literal[
    "income", "spend", "refund", "transfer", "uncategorized_credit", "excluded_currency"
]


def signed_cents(amount_cents: int, direction: str) -> int:
    """The ONLY place a sign is applied: credit = +, debit = -."""
    if direction == "credit":
        return amount_cents
    if direction == "debit":
        return -amount_cents
    raise ValueError("direction must be 'debit' or 'credit'")


def classify(category: str | None, direction: str, currency: str) -> RowKind:
    if currency != "USD":
        return "excluded_currency"
    if category == "transfer":
        return "transfer"
    if category == "income":
        # A debit in income is a chargeback: still income-kind, negative signed value.
        return "income"
    if direction == "credit":
        return "uncategorized_credit" if category is None else "refund"
    return "spend"
