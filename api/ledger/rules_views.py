from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from .categories import is_valid_category
from .errors import ApiError
from .flags import flag
from .models import MerchantRule
from .rules import apply_rules, matching_ids, normalize_merchant
from .serializers import (
    ErrorSerializer,
    MerchantRuleCreatedSerializer,
    MerchantRuleListSerializer,
    MerchantRuleRequestSerializer,
    RulePreviewSerializer,
)
from .tax_views import require_member
from .views import LedgerView


def require_flag() -> None:
    if not flag("merchant-rules"):
        raise ApiError(404, "feature_disabled", "This feature isn't available.")


def _checked(merchant: str, category: str) -> str:
    key = normalize_merchant(merchant)
    if not key:
        raise ApiError(400, "invalid_merchant", "Enter a merchant name.")
    if not is_valid_category(category):
        raise ApiError(400, "invalid_category", "Pick a category from the list.")
    return key


def _rule_data(rule: MerchantRule) -> dict[str, object]:
    return {
        "id": rule.pk,
        "merchant": rule.merchant,
        "category": rule.category,
        "created_at": rule.created_at,
    }


class RulePreviewView(LedgerView):
    @extend_schema(
        operation_id="previewRule",
        parameters=[
            OpenApiParameter("merchant", str, required=True),
            OpenApiParameter("category", str, required=True),
        ],
        responses={200: RulePreviewSerializer, 400: ErrorSerializer, 404: ErrorSerializer},
    )
    def get(self, request: Request) -> Response:
        require_flag()
        merchant = request.query_params.get("merchant", "")
        category = request.query_params.get("category", "")
        key = _checked(merchant, category)
        return Response(
            {
                "merchant": merchant,
                "category": category,
                "matching_uncategorized_count": len(matching_ids(key)),
            }
        )


class RuleListView(LedgerView):
    @extend_schema(
        operation_id="listRules",
        responses={200: MerchantRuleListSerializer, 404: ErrorSerializer},
    )
    def get(self, request: Request) -> Response:
        require_flag()
        member = require_member(request)
        rules = MerchantRule.objects.filter(member=member).order_by("merchant_key")
        return Response({"results": [_rule_data(r) for r in rules]})

    @extend_schema(
        operation_id="createRule",
        request=MerchantRuleRequestSerializer,
        responses={
            201: MerchantRuleCreatedSerializer,
            400: ErrorSerializer,
            404: ErrorSerializer,
        },
    )
    def post(self, request: Request) -> Response:
        require_flag()
        ser = MerchantRuleRequestSerializer(data=request.data)
        try:
            ser.is_valid(raise_exception=True)
        except serializers.ValidationError:
            raise ApiError(400, "invalid_merchant", "Enter a merchant and a category.") from None
        merchant, category = ser.validated_data["merchant"], ser.validated_data["category"]
        key = _checked(merchant, category)
        member = require_member(request)
        rule, _ = MerchantRule.objects.update_or_create(
            member=member,
            merchant_key=key,
            defaults={"merchant": merchant.strip(), "category": category},
        )
        applied = apply_rules(member=member, only_key=key)
        return Response({"rule": _rule_data(rule), "applied_count": applied}, status=201)


class RuleDetailView(LedgerView):
    @extend_schema(
        operation_id="deleteRule",
        responses={204: None, 404: ErrorSerializer},
    )
    def delete(self, request: Request, rule_id: int) -> Response:
        require_flag()
        member = require_member(request)
        deleted, _ = MerchantRule.objects.filter(member=member, pk=rule_id).delete()
        if not deleted:
            raise ApiError(404, "not_found", "Rule not found.")
        return Response(status=204)
