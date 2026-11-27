"""In-memory Ledgerly stand-in implementing the LedgerlyClient surface.

Reproduces the real vendor's quirks (vendor/server.py): offset cursor as a string,
``(posted_on, id)`` descending order, ``limit`` capped at 100, ``next_cursor`` None at the end,
``updated_at`` with 1-second resolution, ids reused after a restart.
"""

from __future__ import annotations

import copy
import json
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from ledger.vendor import VendorNotFound, VendorRejected, VendorUnavailable

MAX_LIMIT = 100

_SEED_FALLBACK = [
    {
        "id": "txn_000001",
        "account_id": "acc_checking",
        "posted_on": "2026-10-28",
        "amount_cents": 4599,
        "direction": "debit",
        "currency": "USD",
        "merchant": "Blue Bottle Coffee",
        "category": "meals",
        "description": "Client coffee",
        "status": "posted",
        "updated_at": "2026-10-28T15:02:11Z",
    },
    {
        "id": "txn_000002",
        "account_id": "acc_checking",
        "posted_on": "2026-10-25",
        "amount_cents": 850000,
        "direction": "credit",
        "currency": "USD",
        "merchant": "Acme Studio LLC",
        "category": "income",
        "description": "Invoice #1042",
        "status": "posted",
        "updated_at": "2026-10-25T09:40:00Z",
    },
    {
        "id": "txn_000003",
        "account_id": "acc_card",
        "posted_on": "2026-10-21",
        "amount_cents": 2400,
        "direction": "debit",
        "currency": "USD",
        "merchant": "Figma",
        "category": "software",
        "description": "Monthly seat",
        "status": "posted",
        "updated_at": "2026-10-21T00:00:05Z",
    },
    {
        "id": "txn_000004",
        "account_id": "acc_card",
        "posted_on": "2026-10-14",
        "amount_cents": 31275,
        "direction": "debit",
        "currency": "USD",
        "merchant": "Delta Air Lines",
        "category": None,
        "description": "AUS to SFO",
        "status": "pending",
        "updated_at": "2026-10-14T22:18:40Z",
    },
    {
        "id": "txn_000005",
        "account_id": "acc_card",
        "posted_on": "2026-10-14",
        "amount_cents": 2400,
        "direction": "credit",
        "currency": "USD",
        "merchant": "Figma",
        "category": "software",
        "description": "Refund: duplicate seat",
        "status": "posted",
        "updated_at": "2026-10-16T11:05:12Z",
    },
]


def load_seed() -> list[dict]:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "vendor" / "seed.json"
        if candidate.exists():
            return json.loads(candidate.read_text())
    return copy.deepcopy(_SEED_FALLBACK)


def iso_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class FakeLedgerly:
    def __init__(self, seed: list[dict] | None = None) -> None:
        self._seed = copy.deepcopy(seed if seed is not None else load_seed())
        self.rows: dict[str, dict] = {}
        self.page_size = MAX_LIMIT  # lower it to force multi-page sync with few rows
        self.down = False
        self.repeat_cursor = False
        self.insert_during_paging: dict | None = None
        self.delete_during_paging: str | None = None
        self.before_page: Callable[[int], None] | None = None
        self.clock: Callable[[], str] = iso_now
        self.calls: list[tuple] = []
        self.limits_requested: list[int] = []
        self.restart()

    # -- test knobs ---------------------------------------------------------------------------
    def restart(self) -> None:
        """Vendor restart: back to the seed, ids reused."""
        self.rows = {r["id"]: copy.deepcopy(r) for r in self._seed}
        self._next_id = len(self._seed) + 1

    def post(self, row: dict) -> dict:
        row = copy.deepcopy(row)
        if "id" not in row:
            row["id"] = f"txn_{self._next_id:06d}"
            self._next_id += 1
        row.setdefault("account_id", "acc_checking")
        row.setdefault("currency", "USD")
        row.setdefault("status", "posted")
        row.setdefault("category", None)
        row.setdefault("description", "")
        row.setdefault("updated_at", self.clock())
        self.rows[row["id"]] = row
        return copy.deepcopy(row)

    def delete(self, txn_id: str) -> None:
        self.rows.pop(txn_id, None)

    def set_pending_posted(self, txn_id: str, amount_cents: int, posted_on: str) -> None:
        """The pending row posts: same id, new amount and date, status posted."""
        row = self.rows[txn_id]
        row.update(
            amount_cents=amount_cents, posted_on=posted_on, status="posted", updated_at=self.clock()
        )

    def calls_named(self, name: str) -> list[tuple]:
        return [c for c in self.calls if c[0] == name]

    # -- LedgerlyClient surface ---------------------------------------------------------------
    def _check(self, name: str, *args) -> None:
        self.calls.append((name, *args))
        if self.down:
            raise VendorUnavailable("fake vendor down")

    def _sorted(self) -> list[dict]:
        return sorted(self.rows.values(), key=lambda r: (r["posted_on"], r["id"]), reverse=True)

    def list_page(self, cursor: str | None = None) -> tuple[list[dict], str | None]:
        self._check("list_page", cursor)
        self.limits_requested.append(MAX_LIMIT)
        if self.repeat_cursor:
            return [copy.deepcopy(r) for r in self._sorted()[: self.page_size]], "100"
        offset = int(cursor or 0)
        ordered = self._sorted()
        limit = min(self.page_size, MAX_LIMIT)
        page = [copy.deepcopy(r) for r in ordered[offset : offset + limit]]
        nxt = str(offset + limit) if offset + limit < len(ordered) else None
        page_no = offset // limit if limit else 0
        if self.before_page:
            self.before_page(page_no)
        if page_no == 0:
            if self.insert_during_paging:
                self.post(self.insert_during_paging)
            if self.delete_during_paging:
                self.delete(self.delete_during_paging)
        return page, nxt

    def get(self, txn_id: str) -> dict:
        self._check("get", txn_id)
        if txn_id not in self.rows:
            raise VendorNotFound(f"{txn_id} not found")
        return copy.deepcopy(self.rows[txn_id])

    def update(self, txn_id: str, fields: dict) -> dict:
        self._check("update", txn_id, dict(fields))
        if txn_id not in self.rows:
            raise VendorNotFound(f"{txn_id} not found")
        if not fields.keys() <= {"category", "description"}:
            raise VendorRejected("read-only field")
        row = self.rows[txn_id]
        row.update(fields)
        row["updated_at"] = self.clock()  # 1-second resolution, bumps even for no-op bodies
        return copy.deepcopy(row)

    def create(self, fields: dict) -> dict:
        self._check("create", dict(fields))
        return self.post(dict(fields))

    def health(self) -> bool:
        self.calls.append(("health",))
        return not self.down
