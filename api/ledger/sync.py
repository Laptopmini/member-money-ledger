"""Mirror Ledgerly into Postgres.

Rules (ADR 0019/0020): vendor wins whenever a row differs, except rows we PUT after this run
started; malformed rows are quarantined in SyncRejection (a previously valid row that turns
malformed keeps its last good copy); a row missing from the listing is tombstoned only after
GET /v1/transactions/{id} answers 404. Nothing is written if the vendor fails mid-run.
Logs carry ids/counts/codes only, never merchant or description text.
"""

import hashlib
import logging
import re
import time
from datetime import UTC, date, datetime, timedelta
from typing import Any

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

from .models import AuditEvent, DataVersion, SyncRejection, SyncRun, Transaction
from .vendor import (
    TXN_ID_RE,
    LedgerlyClient,
    VendorError,
    VendorNotFound,
)

log = logging.getLogger(__name__)

MAX_PAGES = 10_000
ADVISORY_LOCK_KEY = 7_345_001
CURRENCY_RE = re.compile(r"\A[A-Z]{3}\Z")
DATE_RE = re.compile(r"\A\d{4}-\d{2}-\d{2}\Z")
AUDITED_FIELDS = ("category", "status", "amount_cents", "posted_on")
COMPARED_FIELDS = (
    "account_id",
    "posted_on",
    "amount_cents",
    "direction",
    "currency",
    "merchant",
    "description",
    "category",
    "status",
    "vendor_updated_at",
)


def parse_vendor_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def validate_vendor_row(raw: object) -> dict[str, Any] | str:
    """Return the cleaned row, or a short rejection reason (never echoes values)."""
    if not isinstance(raw, dict):
        return "not_an_object"
    rid = raw.get("id")
    if not isinstance(rid, str) or not TXN_ID_RE.match(rid):
        return "bad_id"
    if not isinstance(raw.get("account_id"), str) or not raw["account_id"]:
        return "bad_account_id"
    posted = raw.get("posted_on")
    if not isinstance(posted, str) or not DATE_RE.match(posted):
        return "bad_posted_on"
    try:
        posted_date = date.fromisoformat(posted)
    except ValueError:
        return "bad_posted_on"
    amount = raw.get("amount_cents")
    if isinstance(amount, bool) or not isinstance(amount, int) or amount < 0:
        return "bad_amount_cents"
    if raw.get("direction") not in ("debit", "credit"):
        return "bad_direction"
    currency = raw.get("currency")
    if not isinstance(currency, str) or not CURRENCY_RE.match(currency):
        return "bad_currency"
    if not isinstance(raw.get("merchant"), str):
        return "bad_merchant"
    category = raw.get("category")
    if category is not None and not isinstance(category, str):
        return "bad_category"
    description = raw.get("description")
    if description is None:
        description = ""
    if not isinstance(description, str):
        return "bad_description"
    if raw.get("status") not in ("pending", "posted"):
        return "bad_status"
    updated = parse_vendor_datetime(raw.get("updated_at"))
    if updated is None:
        return "bad_updated_at"
    return {
        "id": rid,
        "account_id": raw["account_id"],
        "posted_on": posted_date,
        "amount_cents": amount,
        "direction": raw["direction"],
        "currency": currency,
        "merchant": raw["merchant"],
        "description": description,
        "category": category,
        "status": raw["status"],
        "vendor_updated_at": updated,
    }


def _rejection_key(raw: object) -> str:
    rid = raw.get("id") if isinstance(raw, dict) else None
    if isinstance(rid, str) and 0 < len(rid) <= 100:
        return rid
    digest = hashlib.sha256(repr(raw).encode()).hexdigest()[:16]
    return f"invalid-{digest}"


def _jsonable(value: Any) -> Any:
    return value.isoformat() if isinstance(value, date | datetime) else value


def _fetch_pass(client: LedgerlyClient) -> tuple[list[Any], bool]:
    """Returns (rows, ended_on_null_cursor)."""
    rows: list[Any] = []
    cursor: str | None = None
    seen_cursors: set[str] = set()
    for _ in range(MAX_PAGES):
        page, nxt = client.list_page(cursor)
        rows.extend(page)
        if nxt is None:
            return rows, True
        if nxt in seen_cursors or not page:
            return rows, False
        seen_cursors.add(nxt)
        cursor = nxt
    return rows, False


def _fetch_all(client: LedgerlyClient, max_passes: int = 3) -> list[Any]:
    """Offset cursors drift when the vendor changes mid-listing: that shows up as a duplicate
    id (and can hide a row). Re-list when a duplicate is seen; upsert-by-id keeps any leftover
    duplicates harmless."""
    rows: list[Any] = []
    for _ in range(max_passes):
        rows, clean_end = _fetch_pass(client)
        ids = [r.get("id") for r in rows if isinstance(r, dict)]
        if not clean_end or len(ids) == len(set(ids)):
            break
    return rows


def apply_row(
    clean: dict[str, Any],
    existing: Transaction | None,
    run: SyncRun,
    now: datetime,
) -> str:
    """Upsert one validated row. Returns 'created' | 'updated' | 'unchanged' | 'skipped'."""
    if existing is None:
        Transaction.objects.create(**clean, last_seen_sync_id=run.pk)
        return "created"
    if existing.local_write_at is not None and existing.local_write_at >= run.started_at:
        return "skipped"  # we PUT this row after the run started: our write is newer
    changed = {f: getattr(existing, f) for f in COMPARED_FIELDS if getattr(existing, f) != clean[f]}
    revived = existing.deleted_at is not None
    flags = existing.missing_since is not None or revived or existing.last_seen_sync_id != run.pk
    if not changed and not revived:
        if flags:
            Transaction.objects.filter(pk=existing.pk).update(
                missing_since=None, last_seen_sync_id=run.pk
            )
        return "unchanged"
    audited = {f: old for f, old in changed.items() if f in AUDITED_FIELDS}
    for f in COMPARED_FIELDS:
        setattr(existing, f, clean[f])
    existing.missing_since = None
    existing.deleted_at = None
    existing.last_seen_sync_id = run.pk
    existing.save()
    if audited:
        AuditEvent.objects.create(
            actor="sync",
            action="synced",
            txn_id=existing.pk,
            before={k: _jsonable(v) for k, v in audited.items()},
            after={k: _jsonable(clean[k]) for k in audited},
            at=now,
        )
    return "updated"


def run_sync(client: LedgerlyClient | None = None) -> SyncRun:
    client = client or LedgerlyClient()
    run = SyncRun.objects.create(started_at=timezone.now(), status="running")
    try:
        _run(client, run)
    except VendorError as exc:
        _finish(run, "failed", "vendor_unavailable")
        log.warning(
            "sync_failed run=%s code=vendor_unavailable type=%s", run.pk, type(exc).__name__
        )
    except Exception:
        _finish(run, "failed", "internal")
        log.exception("sync_failed run=%s code=internal", run.pk)
        raise
    return run


def _finish(run: SyncRun, status: str, error_code: str = "") -> None:
    run.status = status
    run.error_code = error_code
    run.finished_at = timezone.now()
    run.save()


def _run(client: LedgerlyClient, run: SyncRun) -> None:
    raw_rows = _fetch_all(client)  # network first: a failure leaves our data untouched
    run.fetched = len(raw_rows)

    valid: dict[str, dict[str, Any]] = {}
    rejected: dict[str, tuple[str, Any]] = {}
    for raw in raw_rows:
        result = validate_vendor_row(raw)
        if isinstance(result, str):
            rejected[_rejection_key(raw)] = (result, raw)
        else:
            valid[result["id"]] = result  # dedupe by id: last one wins

    seen_ids = set(valid) | {k for k in rejected}
    candidates = list(
        Transaction.objects.visible().exclude(pk__in=seen_ids).values_list("pk", flat=True)
    )
    confirmed_gone: list[str] = []
    still_there: dict[str, dict[str, Any]] = {}
    for txn_id in candidates:
        try:
            result = validate_vendor_row(client.get(txn_id))
        except VendorNotFound:
            confirmed_gone.append(txn_id)
            continue
        if isinstance(result, dict) and result["id"] == txn_id:
            still_there[txn_id] = result  # skipped by offset drift: it still exists
        # a malformed-but-existing row keeps its last good copy

    now = timezone.now()
    counts = {"created": 0, "updated": 0, "unchanged": 0, "skipped": 0}
    with transaction.atomic():
        existing = Transaction.objects.in_bulk(list(valid) + list(still_there))
        for txn_id, clean in {**valid, **still_there}.items():
            outcome = apply_row(clean, existing.get(txn_id), run, now)
            counts[outcome] += 1
        gone = Transaction.objects.filter(pk__in=confirmed_gone, deleted_at__isnull=True)
        tombstoned = gone.update(deleted_at=now, missing_since=now)

        SyncRejection.objects.filter(txn_id__in=list(valid)).delete()
        for key, (reason, raw) in rejected.items():
            row, created = SyncRejection.objects.get_or_create(
                txn_id=key, defaults={"reason": reason, "payload": raw if raw is not None else {}}
            )
            if not created:
                row.reason, row.payload, row.last_seen_at = reason, raw, now
                row.save()

        run.upserted = counts["created"] + counts["updated"]
        run.unchanged = counts["unchanged"] + counts["skipped"]
        run.rejected = len(rejected)
        run.tombstoned = tombstoned
        if run.upserted or tombstoned:
            DataVersion.bump()
        _finish(run, "ok")


def _try_lock(cur: Any) -> bool:
    cur.execute("SELECT pg_try_advisory_lock(%s)", [ADVISORY_LOCK_KEY])
    return bool(cur.fetchone()[0])


def sync_with_lock(client: LedgerlyClient | None = None, wait: bool = False) -> SyncRun | None:
    """Run a sync under a session advisory lock held on its own connection.
    Returns None when another sync holds the lock (and `wait` is false / times out)."""
    lock_conn = connection.copy()
    try:
        with lock_conn.cursor() as cur:
            deadline = time.monotonic() + 30
            while not _try_lock(cur):
                if not wait or time.monotonic() > deadline:
                    return None
                time.sleep(0.5)
            try:
                # We hold the lock, so any "running" row is a crashed leftover.
                SyncRun.objects.filter(status="running").update(
                    status="failed", error_code="interrupted", finished_at=timezone.now()
                )
                return run_sync(client)
            finally:
                cur.execute("SELECT pg_advisory_unlock(%s)", [ADVISORY_LOCK_KEY])
    finally:
        lock_conn.close()


def last_sync_ok() -> SyncRun | None:
    return SyncRun.objects.filter(status="ok").order_by("-started_at").first()


def maybe_sync_if_stale() -> None:
    """Refresh on read when the mirror is stale. Never raises: callers serve cached data."""
    cutoff = timezone.now() - timedelta(seconds=settings.SYNC_STALE_SECONDS)
    last_attempt = SyncRun.objects.order_by("-started_at").first()
    last_ok = last_sync_ok()
    if last_ok and last_ok.started_at > cutoff:
        return
    if last_attempt and last_attempt.started_at > cutoff:
        return  # recent failed/running attempt: don't hammer a down vendor on every request
    try:
        sync_with_lock()
    except Exception as exc:  # noqa: BLE001 - reads must survive any sync failure
        log.warning("maybe_sync_failed type=%s", type(exc).__name__)
