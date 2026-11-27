"""Deterministic demo data (Sep-Nov 2026) for `reset_mirror --seed`.

The vendor validates nothing on POST, so every row is checked with the same validator the
sync uses BEFORE it is sent. Note: the vendor's POST always creates `posted` USD rows, so the
only pending row in the demo is the vendor seed's own (txn_000004).
"""

from typing import Any

from .sync import validate_vendor_row

CHK, CARD = "acc_checking", "acc_card"

# (date, account, direction, cents, merchant, category, description)
_Row = tuple[str, str, str, int, str, str | None, str]

_INCOME: list[_Row] = [
    ("2026-09-04", CHK, "credit", 620000, "Acme Studio LLC", "income", "Invoice #1038"),
    ("2026-09-19", CHK, "credit", 310000, "Northwind Traders", "income", "Retainer Sep"),
    ("2026-09-27", CHK, "credit", 185000, "Globex Design", "income", "Brand sprint"),
    ("2026-10-09", CHK, "credit", 310000, "Northwind Traders", "income", "Retainer Oct"),
    ("2026-10-30", CHK, "credit", 205000, "Globex Design", "income", "Logo refresh"),
    ("2026-11-06", CHK, "credit", 720000, "Acme Studio LLC", "income", "Invoice #1051"),
    ("2026-11-13", CHK, "credit", 310000, "Northwind Traders", "income", "Retainer Nov"),
    ("2026-11-20", CHK, "credit", 140000, "Globex Design", "income", "Landing page"),
]

_SOFTWARE: list[_Row] = [
    (f"2026-{m:02d}-{d:02d}", CARD, "debit", cents, name, "software", desc)
    for m in (9, 10, 11)
    for d, cents, name, desc in (
        (3, 1000, "Notion", "Team plan"),
        (10, 5499, "Adobe Creative Cloud", "All apps"),
        (21, 2400, "Figma", "Monthly seat"),
    )
]

_MEALS: list[_Row] = [
    ("2026-09-08", CARD, "debit", 4250, "Blue Bottle Coffee", "meals", "Client coffee"),
    ("2026-09-17", CARD, "debit", 8830, "Uchi Austin", "meals", "Client dinner"),
    ("2026-09-29", CARD, "debit", 1875, "Torchy's Tacos", "meals", "Lunch"),
    ("2026-10-07", CARD, "debit", 3120, "Blue Bottle Coffee", "meals", "Working session"),
    ("2026-10-16", CARD, "debit", 6410, "Uchi Austin", "meals", "Client dinner"),
    ("2026-11-04", CARD, "debit", 2190, "Blue Bottle Coffee", "meals", "Client coffee"),
    ("2026-11-12", CARD, "debit", 7260, "Uchi Austin", "meals", "Team dinner"),
    ("2026-11-18", CARD, "debit", 1640, "Torchy's Tacos", "meals", "Lunch"),
]

_TRAVEL: list[_Row] = [
    ("2026-09-12", CARD, "debit", 28900, "Delta Air Lines", "travel", "AUS to DEN"),
    ("2026-09-14", CARD, "debit", 41200, "Marriott", "travel", "Conference hotel"),
    ("2026-09-15", CARD, "debit", 3850, "Uber", "travel", "Airport"),
    ("2026-09-26", CARD, "credit", 28900, "Delta Air Lines", "travel", "Refund: cancelled flight"),
    ("2026-11-08", CARD, "debit", 36400, "Southwest Airlines", "travel", "AUS to LAX"),
    ("2026-11-10", CARD, "debit", 5120, "Uber", "travel", "Ride to client"),
]

_TRANSFERS: list[_Row] = [
    (d, acc, direction, 120000, "Card payment", "transfer", "Pay credit card")
    for d in ("2026-10-31", "2026-11-24")
    for acc, direction in ((CHK, "debit"), (CARD, "credit"))
]

_OTHER: list[_Row] = [
    ("2026-09-02", CHK, "debit", 9900, "Hiscox", "insurance", "Liability insurance"),
    ("2026-09-06", CARD, "debit", 7500, "Comcast Business", "utilities", "Internet"),
    ("2026-10-06", CARD, "debit", 7500, "Comcast Business", "utilities", "Internet"),
    ("2026-11-06", CARD, "debit", 7500, "Comcast Business", "utilities", "Internet"),
    ("2026-10-12", CARD, "debit", 14900, "Staples", "office", "Printer ink and paper"),
    ("2026-11-15", CHK, "debit", 52000, "WeWork", "rent", "Coworking desk"),
    ("2026-09-22", CARD, "debit", 6400, "Spotify", "personal", "Family plan"),
    # Uncategorized on purpose: repeat merchants so categorization rules have something to learn
    ("2026-09-23", CARD, "debit", 1299, "Amazon", None, "Order"),
    ("2026-10-19", CARD, "debit", 2745, "Amazon", None, "Order"),
    ("2026-11-02", CARD, "debit", 3810, "Amazon", None, "Order"),
    ("2026-11-14", CARD, "debit", 1550, "Shell", None, "Fuel"),
    ("2026-11-21", CARD, "debit", 2210, "Blue Bottle Coffee", None, "Coffee"),
    ("2026-11-22", CARD, "credit", 4500, "Venmo", None, "Payment from friend"),
]

_MORE: list[_Row] = [
    ("2026-09-09", CARD, "debit", 25000, "Meta Ads", "advertising", "Campaign"),
    ("2026-10-09", CARD, "debit", 30000, "Meta Ads", "advertising", "Campaign"),
    ("2026-11-09", CARD, "debit", 27500, "Meta Ads", "advertising", "Campaign"),
    ("2026-09-30", CHK, "debit", 120000, "Jamie Rivera", "contractors", "Illustration work"),
    ("2026-11-17", CHK, "debit", 90000, "Jamie Rivera", "contractors", "Illustration work"),
    ("2026-09-20", CHK, "debit", 3000, "First Bank", "fees", "Wire fee"),
    ("2026-10-20", CHK, "debit", 1500, "Stripe", "fees", "Processing fees"),
    ("2026-11-19", CHK, "debit", 1800, "Stripe", "fees", "Processing fees"),
    ("2026-10-23", CARD, "debit", 129900, "Apple", "equipment", "Monitor"),
    ("2026-11-11", CHK, "debit", 45000, "LegalZoom", "professional_services", "Contract review"),
    ("2026-10-27", CARD, "debit", 2600, "Torchy's Tacos", "meals", "Lunch"),
    ("2026-11-23", CARD, "debit", 5300, "Local Pizza Co", "personal", "Dinner"),
]

DEMO_ROWS: list[_Row] = sorted(
    [*_INCOME, *_SOFTWARE, *_MEALS, *_TRAVEL, *_TRANSFERS, *_OTHER, *_MORE],
    key=lambda r: (r[0], r[3]),
)


def demo_payloads() -> list[dict[str, Any]]:
    """The POST bodies, each validated with the sync validator (raises on a bad row)."""
    out: list[dict[str, Any]] = []
    for posted_on, account, direction, cents, merchant, category, description in DEMO_ROWS:
        body = {
            "account_id": account,
            "posted_on": posted_on,
            "amount_cents": cents,
            "direction": direction,
            "merchant": merchant,
            "category": category,
            "description": description,
        }
        probe = {
            **body,
            "id": "demo",
            "currency": "USD",
            "status": "posted",
            "updated_at": "2026-11-27T00:00:00Z",
        }
        result = validate_vendor_row(probe)
        if isinstance(result, str):
            raise ValueError(f"demo row invalid: {result}")
        out.append(body)
    return out
