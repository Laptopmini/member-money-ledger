from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Sum
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from . import tax
from .errors import ApiError, request_id_of
from .flags import flag
from .members import member_for
from .models import AuditEvent, DataVersion, SetAsideMark, TaxSettings, Transaction
from .net import client_ip
from .serializers import (
    ErrorSerializer,
    SetAsideMarkRequestSerializer,
    SetAsideMarkSerializer,
    SetAsideSerializer,
    TaxSettingsResponseSerializer,
    TaxSettingsSerializer,
)
from .views import DATE_RE, LedgerView, actor_label


def server_today() -> date:
    return datetime.now(UTC).date()


def require_flag() -> None:
    if not flag("tax-set-aside"):
        raise ApiError(404, "feature_disabled", "This feature isn't available.")


def _rate_for(member: Any) -> Decimal:
    row = TaxSettings.objects.filter(member=member).first()
    return row.rate if row else tax.DEFAULT_RATE


def _quarter(value: str, today: date) -> tax.Period:
    try:
        parsed = tax.parse_quarter(value)
    except ValueError:
        raise ApiError(400, "invalid_quarter", "quarter must look like 2026-Q4.") from None
    if abs(parsed.year - today.year) > 1:
        raise ApiError(400, "invalid_quarter", "That quarter is out of range.")
    return parsed


def require_member(request: Request) -> Any:
    member = member_for(request)
    if member is None:
        raise ApiError(503, "no_member", "No member account is set up.")
    return member


def _marks_total(member: Any, quarter: str) -> int:
    total = SetAsideMark.objects.filter(member=member, quarter=quarter).aggregate(
        s=Sum("amount_cents")
    )
    return int(total["s"] or 0)


class SetAsideView(LedgerView):
    @extend_schema(
        operation_id="getTaxSetAside",
        parameters=[
            OpenApiParameter("quarter", str, description="2026-Q4; default: the current period"),
            OpenApiParameter("today", str, description="YYYY-MM-DD override (tests/demo)"),
        ],
        responses={200: SetAsideSerializer, 400: ErrorSerializer, 404: ErrorSerializer},
    )
    def get(self, request: Request) -> Response:
        require_flag()
        qp = request.query_params
        today = server_today()
        server_day = today
        if qp.get("today"):
            if not DATE_RE.match(qp["today"]):
                raise ApiError(400, "invalid_date", "today must be YYYY-MM-DD.")
            try:
                today = date.fromisoformat(qp["today"])
            except ValueError:
                raise ApiError(400, "invalid_date", "today must be a real date.") from None
            # The browser supplies the member's local date; it can differ from UTC by one day.
            if abs((today - server_day).days) > 1:
                raise ApiError(400, "invalid_date", "today is too far from the server date.")
        the_period = (
            _quarter(qp["quarter"], today) if qp.get("quarter") else tax.default_period(today)
        )
        member = require_member(request)

        rows = (
            Transaction.objects.for_member(request.user)
            .filter(posted_on__gte=the_period.start, posted_on__lte=the_period.end)
            .values("category", "status", "currency", "direction")
            .annotate(total=Sum("amount_cents"), n=Count("id"))
        )
        data = tax.compute_set_aside(
            [dict(r) for r in rows],
            rate=_rate_for(member),
            set_aside_cents=_marks_total(member, the_period.label),
            the_period=the_period,
            today=today,
        )
        return Response(data)


class TaxSettingsView(LedgerView):
    @extend_schema(
        operation_id="updateTaxSettings",
        request=TaxSettingsSerializer,
        responses={200: TaxSettingsResponseSerializer, 400: ErrorSerializer},
    )
    def put(self, request: Request) -> Response:
        require_flag()
        ser = TaxSettingsSerializer(data=request.data)
        try:
            ser.is_valid(raise_exception=True)
        except serializers.ValidationError:
            raise ApiError(400, "invalid_rate", "Rate must be between 0% and 60%.") from None
        rate: Decimal = ser.validated_data["rate"]
        if rate == 0:
            rate = Decimal(0)  # normalise "-0"
        member = require_member(request)
        with transaction.atomic():
            row, _ = TaxSettings.objects.get_or_create(member=member)
            before = float(row.rate)
            row.rate = rate
            row.save()
            AuditEvent.objects.create(
                actor=actor_label(request),
                action="tax_rate_changed",
                txn_id="tax",
                before={"rate": before},
                after={"rate": float(rate)},
                request_id=request_id_of(request),
                ip=client_ip(request),
            )
        return Response({"rate": float(rate)})


class SetAsideMarkView(LedgerView):
    @extend_schema(
        operation_id="createSetAsideMark",
        request=SetAsideMarkRequestSerializer,
        responses={201: SetAsideMarkSerializer, 400: ErrorSerializer, 404: ErrorSerializer},
    )
    def post(self, request: Request) -> Response:
        require_flag()
        ser = SetAsideMarkRequestSerializer(data=request.data)
        try:
            ser.is_valid(raise_exception=True)
        except serializers.ValidationError:
            raise ApiError(
                400, "invalid_amount", "Enter a non-zero amount (reversals need a reason)."
            ) from None
        quarter = _quarter(ser.validated_data["quarter"], server_today()).label
        member = require_member(request)
        amount = ser.validated_data["amount_cents"]
        reason = ser.validated_data.get("reason", "").strip()
        with transaction.atomic():
            # Serialize marks per member so two reversals can't both pass the floor check.
            # request.user is a SimpleLazyObject, so type(member) has no manager: use the model.
            get_user_model().objects.select_for_update().get(pk=member.pk)
            if _marks_total(member, quarter) + amount < 0:
                raise ApiError(400, "invalid_amount", "That would put the total below zero.")
            mark = SetAsideMark.objects.create(
                member=member, quarter=quarter, amount_cents=amount, reason=reason
            )
            # The success event: txn_id carries the quarter for this non-transaction action.
            AuditEvent.objects.create(
                actor=actor_label(request),
                action="set_aside_marked",
                txn_id=f"q:{quarter}",
                after={"quarter": quarter, "amount_cents": mark.amount_cents, "reason": reason},
                request_id=request_id_of(request),
                ip=client_ip(request),
            )
            DataVersion.bump()
        data = {
            "quarter": quarter,
            "amount_cents": mark.amount_cents,
            "set_aside_cents": _marks_total(member, quarter),
            "created_at": mark.created_at,
        }
        return Response(data, status=201)
