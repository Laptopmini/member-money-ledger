from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from .errors import ApiError
from .members import member_for
from .serializers import ErrorSerializer
from .suggest import enabled, resolve
from .views import LedgerView, get_visible_txn


class SuggestionSerializer(serializers.Serializer):  # type: ignore[type-arg]
    category = serializers.CharField(allow_null=True)
    label = serializers.CharField(required=False)  # type: ignore[assignment]
    source = serializers.ChoiceField(  # type: ignore[assignment]
        choices=["rule", "cache", "model"], required=False
    )
    model = serializers.CharField(allow_null=True, required=False)


class SuggestionView(LedgerView):
    # It can cost money, so it shares the stricter `writes` limit even though it is a GET.
    throttle_scope = "writes"

    @extend_schema(
        operation_id="getTransactionSuggestion",
        responses={200: SuggestionSerializer, 404: ErrorSerializer},
    )
    def get(self, request: Request, txn_id: str) -> Response:
        if not enabled():
            raise ApiError(404, "feature_disabled", "This feature isn't available.")
        txn = get_visible_txn(request, txn_id)
        return Response(resolve(txn, member_for(request)))
