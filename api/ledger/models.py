from decimal import Decimal
from typing import Any

from django.conf import settings
from django.db import models, transaction
from django.db.models import F
from django.utils import timezone

from .categories import is_valid_category, label_for
from .money import classify, signed_cents

ACCOUNT_LABELS = {"acc_checking": "Checking", "acc_card": "Card"}


class TransactionQuerySet(models.QuerySet["Transaction"]):
    def visible(self) -> TransactionQuerySet:
        return self.filter(deleted_at__isnull=True)

    def for_member(self, user: Any = None) -> TransactionQuerySet:
        """Tenant scope. Single tenant today (one bank feed = one member), so this is
        `.visible()`. Every view goes through it so per-member scoping is a one-line change."""
        return self.visible()


class Transaction(models.Model):
    STATUS_CHOICES = [("pending", "pending"), ("posted", "posted")]
    DIRECTION_CHOICES = [("debit", "debit"), ("credit", "credit")]

    id = models.CharField(primary_key=True, max_length=64)
    account_id = models.CharField(max_length=64)
    posted_on = models.DateField()  # member-local date, never a datetime
    amount_cents = models.BigIntegerField()  # always positive; sign comes from direction
    direction = models.CharField(max_length=6, choices=DIRECTION_CHOICES)
    currency = models.CharField(max_length=3)
    merchant = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    category = models.CharField(max_length=64, null=True, blank=True)  # noqa: DJ001
    status = models.CharField(max_length=7, choices=STATUS_CHOICES)
    vendor_updated_at = models.DateTimeField()
    local_write_at = models.DateTimeField(null=True, blank=True)
    last_seen_sync_id = models.BigIntegerField(null=True, blank=True)
    missing_since = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    objects = TransactionQuerySet.as_manager()

    class Meta:
        indexes = [
            models.Index(fields=["posted_on"], name="txn_posted_on_idx"),
            models.Index(fields=["category"], name="txn_category_idx"),
            models.Index(fields=["status"], name="txn_status_idx"),
            models.Index(fields=["-posted_on", "-id"], name="txn_posted_id_desc_idx"),
        ]

    def __str__(self) -> str:  # no merchant/description: safe to log
        return self.id

    # Derived presentation fields (money rules live in money.py / categories.py).
    @property
    def signed_cents(self) -> int:
        return signed_cents(self.amount_cents, self.direction)

    @property
    def kind(self) -> str:
        return classify(self.category, self.direction, self.currency)

    @property
    def category_label(self) -> str:
        return label_for(self.category)

    @property
    def category_known(self) -> bool:
        return self.category is None or is_valid_category(self.category)

    @property
    def account_label(self) -> str:
        return ACCOUNT_LABELS.get(self.account_id, self.account_id.removeprefix("acc_").title())


class SyncRun(models.Model):
    STATUS_CHOICES = [("running", "running"), ("ok", "ok"), ("failed", "failed")]

    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=7, choices=STATUS_CHOICES, default="running")
    fetched = models.IntegerField(default=0)
    upserted = models.IntegerField(default=0)
    unchanged = models.IntegerField(default=0)
    rejected = models.IntegerField(default=0)
    tombstoned = models.IntegerField(default=0)
    error_code = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        indexes = [models.Index(fields=["-started_at"], name="syncrun_started_idx")]

    def __str__(self) -> str:
        return f"sync {self.pk} {self.status}"


class SyncRejection(models.Model):
    txn_id = models.CharField(max_length=128, unique=True)
    reason = models.CharField(max_length=255)
    payload = models.JSONField(default=dict)
    first_seen_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(default=timezone.now)

    def __str__(self) -> str:
        return self.txn_id


class AppendOnlyError(RuntimeError):
    pass


class AuditEvent(models.Model):
    """Append-only: updates and deletes are refused."""

    actor = models.CharField(max_length=32)  # member | sync
    action = models.CharField(max_length=32)  # recategorize | synced
    txn_id = models.CharField(max_length=64, db_index=True)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    request_id = models.CharField(max_length=64, blank=True, default="")
    ip = models.GenericIPAddressField(null=True, blank=True)
    at = models.DateTimeField(default=timezone.now)

    def __str__(self) -> str:
        return f"{self.actor}:{self.action}:{self.txn_id}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None and not self._state.adding:
            raise AppendOnlyError("AuditEvent is append-only")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise AppendOnlyError("AuditEvent is append-only")


class DataVersion(models.Model):
    """Single-row counter bumped on every local data change (sync change or recategorize).
    The summary ETag is hash(month + version): deterministic, no clock resolution issues."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    version = models.BigIntegerField(default=0)

    def __str__(self) -> str:
        return f"v{self.version}"

    @classmethod
    def bump(cls) -> None:
        with transaction.atomic():
            cls.objects.get_or_create(id=1)
            cls.objects.filter(id=1).update(version=F("version") + 1)

    @classmethod
    def current(cls) -> int:
        return cls.objects.filter(id=1).values_list("version", flat=True).first() or 0


class TaxSettings(models.Model):
    member = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rate = models.DecimalField(max_digits=4, decimal_places=3, default=Decimal("0.25"))

    def __str__(self) -> str:
        return f"rate {self.rate}"


class SetAsideMark(models.Model):
    """Money the member says they put aside for a quarter. Append-only."""

    member = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    quarter = models.CharField(max_length=7, db_index=True)  # "2026-Q4"
    amount_cents = models.BigIntegerField()  # negative = reversal
    reason = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self) -> str:
        return f"{self.quarter} {self.amount_cents}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise AppendOnlyError("SetAsideMark is append-only")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise AppendOnlyError("SetAsideMark is append-only")
