"""Shared fixtures. No network: every vendor call goes to FakeLedgerly."""

from __future__ import annotations

import time
from datetime import UTC, datetime

import pytest
from django.utils import timezone

from ledger.models import SyncRun, Transaction
from ledger.tests.fake_vendor import FakeLedgerly, load_seed


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(time, "sleep", lambda _s: None)


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch) -> FakeLedgerly:
    """A healthy fake vendor wired in wherever the code builds a LedgerlyClient."""
    f = FakeLedgerly()
    factory = lambda *a, **k: f  # noqa: E731
    for target in ("ledger.vendor", "ledger.sync", "ledger.views"):
        monkeypatch.setattr(f"{target}.LedgerlyClient", factory, raising=False)
    return f


def dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


_n = {"i": 100}


@pytest.fixture
def make_txn(db):
    def _make(**kw) -> Transaction:
        _n["i"] += 1
        base = dict(
            id=f"txn_{_n['i']:06d}",
            account_id="acc_checking",
            posted_on="2026-10-10",
            amount_cents=1000,
            direction="debit",
            currency="USD",
            merchant="Test Merchant",
            description="",
            category="meals",
            status="posted",
            vendor_updated_at=dt("2026-10-10T12:00:00Z"),
        )
        base.update(kw)
        if isinstance(base["vendor_updated_at"], str):
            base["vendor_updated_at"] = dt(base["vendor_updated_at"])
        return Transaction.objects.create(**base)

    return _make


@pytest.fixture
def seed_db(db) -> list[Transaction]:
    """The five vendor seed rows mirrored locally (no sync involved)."""
    out = []
    for r in load_seed():
        r = dict(r)
        r["vendor_updated_at"] = dt(r.pop("updated_at"))
        out.append(Transaction.objects.create(**r))
    return out


@pytest.fixture
def fresh_sync(db) -> SyncRun:
    """Mark the mirror as freshly synced so read paths don't auto-sync."""
    now = timezone.now()
    return SyncRun.objects.create(started_at=now, finished_at=now, status="ok")
