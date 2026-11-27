"""Merchant rules: categorize uncategorized rows only, through the same write-through path
as a manual recategorize (vendor PUT first, then the mirror)."""

import logging
from typing import Any

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from .models import AuditEvent, DataVersion, MerchantRule, Transaction
from .sync import validate_vendor_row
from .vendor import LedgerlyClient, VendorNotFound, VendorRejected, VendorUnavailable

log = logging.getLogger(__name__)


def normalize_merchant(value: str) -> str:
    """casefold + collapse whitespace + strip."""
    return " ".join(value.casefold().split())


def matching_ids(key: str) -> list[str]:
    rows = Transaction.objects.visible().filter(category__isnull=True).values_list("pk", "merchant")
    return [pk for pk, merchant in rows if normalize_merchant(merchant) == key]


def _apply_one(client: LedgerlyClient, txn_id: str, category: str) -> bool:
    """True if the row was recategorized. Raises VendorUnavailable (caller stops)."""
    with transaction.atomic():
        txn = (
            Transaction.objects.select_for_update()
            .visible()
            .filter(pk=txn_id, category__isnull=True)  # never touch an explicit category
            .first()
        )
        if txn is None:
            return False
        try:
            clean = validate_vendor_row(client.update(txn_id, {"category": category}))
        except VendorNotFound:
            Transaction.objects.filter(pk=txn_id).update(deleted_at=timezone.now())
            DataVersion.bump()
            return False
        except VendorRejected:
            return False
        if isinstance(clean, str) or clean["id"] != txn_id:
            return False
        for f, value in clean.items():
            setattr(txn, f, value)
        txn.local_write_at = timezone.now()
        txn.missing_since = None
        txn.save()
        AuditEvent.objects.create(
            actor="rule",
            action="rule_applied",
            txn_id=txn_id,
            before={"category": None},
            after={"category": category},
        )
        DataVersion.bump()
        return True


def apply_rules(
    rows: QuerySet[Transaction] | None = None,
    *,
    member: Any,
    client: LedgerlyClient | None = None,
    limit: int | None = None,
    only_key: str | None = None,
) -> int:
    """Apply the member's rules to uncategorized rows in `rows` (default: all visible).
    Stops at the first VendorUnavailable and returns the partial count."""
    rules = {r.merchant_key: r.category for r in MerchantRule.objects.filter(member=member)}
    if only_key is not None:
        rules = {k: v for k, v in rules.items() if k == only_key}
    if not rules:
        return 0
    qs = rows if rows is not None else Transaction.objects.visible()
    candidates = qs.filter(category__isnull=True, deleted_at__isnull=True).values_list(
        "pk", "merchant"
    )
    client = client or LedgerlyClient()
    applied = 0
    for txn_id, merchant in candidates:
        category = rules.get(normalize_merchant(merchant))
        if category is None:
            continue
        if limit is not None and applied >= limit:
            break
        try:
            if _apply_one(client, txn_id, category):
                applied += 1
        except VendorUnavailable:
            log.warning("rules_stopped code=vendor_unavailable applied=%s", applied)
            break
    return applied
