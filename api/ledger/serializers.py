from typing import Any

from rest_framework import serializers

from .models import Transaction

ROW_KIND_CHOICES = [
    ("income", "income"),
    ("spend", "spend"),
    ("refund", "refund"),
    ("transfer", "transfer"),
    ("uncategorized_credit", "uncategorized_credit"),
    ("excluded_currency", "excluded_currency"),
]
CATEGORY_KIND_CHOICES = [(k, k) for k in ("income", "transfer", "personal", "expense")]
SYNC_STATE_CHOICES = [(k, k) for k in ("ok", "running", "vendor_down", "never")]


class TransactionSerializer(serializers.ModelSerializer[Transaction]):
    account_label = serializers.CharField(read_only=True)
    signed_cents = serializers.IntegerField(read_only=True)
    category_label = serializers.CharField(read_only=True)
    category_known = serializers.BooleanField(read_only=True)
    kind = serializers.ChoiceField(choices=ROW_KIND_CHOICES, read_only=True)
    updated_at = serializers.DateTimeField(source="vendor_updated_at", read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id",
            "account_id",
            "account_label",
            "posted_on",
            "amount_cents",
            "direction",
            "signed_cents",
            "currency",
            "merchant",
            "description",
            "category",
            "category_label",
            "category_known",
            "status",
            "kind",
            "updated_at",
        ]
        read_only_fields = fields


class TransactionListSerializer(serializers.Serializer[Any]):
    results = TransactionSerializer(many=True)
    next_cursor = serializers.CharField(allow_null=True)
    synced_at = serializers.DateTimeField(allow_null=True)


class TransactionPatchSerializer(serializers.Serializer[Any]):
    category = serializers.CharField(allow_null=True, required=False, max_length=64)
    description = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    expected_updated_at = serializers.DateTimeField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "category" not in attrs and "description" not in attrs:
            raise serializers.ValidationError("Provide category and/or description.")
        return attrs


class HistoryEventSerializer(serializers.Serializer[Any]):
    at = serializers.DateTimeField()
    actor = serializers.CharField()
    action = serializers.CharField()
    before = serializers.JSONField(allow_null=True)
    after = serializers.JSONField(allow_null=True)


class HistorySerializer(serializers.Serializer[Any]):
    results = HistoryEventSerializer(many=True)


class CategoryBreakdownSerializer(serializers.Serializer[Any]):
    category = serializers.CharField(allow_null=True)
    label = serializers.CharField()  # type: ignore[assignment]
    spend_cents = serializers.IntegerField()
    count = serializers.IntegerField()


class SummarySerializer(serializers.Serializer[Any]):
    month = serializers.CharField()
    income_cents = serializers.IntegerField()
    spend_cents = serializers.IntegerField()
    net_cents = serializers.IntegerField()
    pending_cents = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    uncategorized_count = serializers.IntegerField()
    uncategorized_credit_cents = serializers.IntegerField()
    uncategorized_credit_count = serializers.IntegerField()
    excluded_currency_count = serializers.IntegerField()
    by_category = CategoryBreakdownSerializer(many=True)
    latest_month_with_data = serializers.CharField(allow_null=True)
    synced_at = serializers.DateTimeField(allow_null=True)


class CategorySerializer(serializers.Serializer[Any]):
    key = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]
    schedule_c_line = serializers.CharField(allow_null=True)
    deductible_fraction = serializers.FloatField()
    kind = serializers.ChoiceField(choices=CATEGORY_KIND_CHOICES)


class CategoryListSerializer(serializers.Serializer[Any]):
    results = CategorySerializer(many=True)


class SyncResultSerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=[("ok", "ok")])
    fetched = serializers.IntegerField()
    upserted = serializers.IntegerField()
    rejected = serializers.IntegerField()
    tombstoned = serializers.IntegerField()
    finished_at = serializers.DateTimeField(allow_null=True)


class SyncStatusSerializer(serializers.Serializer[Any]):
    last_success_at = serializers.DateTimeField(allow_null=True)
    last_attempt_at = serializers.DateTimeField(allow_null=True)
    state = serializers.ChoiceField(choices=SYNC_STATE_CHOICES)
    stale = serializers.BooleanField()
    rejected_count = serializers.IntegerField()


class HealthSerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=[("ok", "ok"), ("degraded", "degraded")])
    db = serializers.ChoiceField(choices=[("ok", "ok"), ("error", "error")])
    vendor = serializers.ChoiceField(choices=[("ok", "ok"), ("down", "down")])


class ErrorBodySerializer(serializers.Serializer[Any]):
    code = serializers.CharField()
    message = serializers.CharField()
    request_id = serializers.CharField()


class ErrorSerializer(serializers.Serializer[Any]):
    error = ErrorBodySerializer()
