import base64
import binascii
import hashlib
import logging
import re
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Any

from django.db import connection, transaction
from django.db.models import Count, Max, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status as http
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .categories import CATEGORIES, UNCATEGORIZED_LABEL, is_valid_category, label_for
from .errors import ApiError, request_id_of
from .models import AuditEvent, DataVersion, SyncRejection, SyncRun, Transaction
from .money import classify, signed_cents
from .net import client_ip
from .serializers import (
    CategoryListSerializer,
    ErrorSerializer,
    HealthSerializer,
    HistorySerializer,
    SummarySerializer,
    SyncResultSerializer,
    SyncStatusSerializer,
    TransactionListSerializer,
    TransactionPatchSerializer,
    TransactionSerializer,
)
from .sync import (
    last_sync_ok,
    maybe_sync_if_stale,
    refresh_row,
    sync_with_lock,
    validate_vendor_row,
)
from .vendor import (
    TXN_ID_RE,
    InvalidTransactionId,
    LedgerlyClient,
    VendorNotFound,
    VendorRejected,
    VendorUnavailable,
    validate_txn_id,
)

log = logging.getLogger(__name__)

MONTH_RE = re.compile(r"\A\d{4}-(0[1-9]|1[0-2])\Z")
DATE_RE = re.compile(r"\A\d{4}-\d{2}-\d{2}\Z")
STALE_AFTER = timedelta(minutes=10)
RUNNING_FRESH = timedelta(minutes=5)

STALE_MESSAGE = "This transaction changed in your bank feed. Review and try again."
DOWN_MESSAGE = "We couldn't reach your bank feed. Nothing was changed. Try again in a moment."

ERRORS = {
    400: ErrorSerializer,
    404: ErrorSerializer,
    409: ErrorSerializer,
    502: ErrorSerializer,
}


def actor_label(request: Request) -> str:
    user = request.user
    return str(user.email or user.username)[:32] if user and user.is_authenticated else "member"


class LedgerView(APIView):
    """Base for every endpoint. Authentication/permission come from REST_FRAMEWORK defaults,
    so a global IsAuthenticated can be added in settings without touching views.

    Throttle scope is `reads` for safe methods and `writes` otherwise unless a view sets its own.
    Mutating requests must be application/json: a cross-site form POST cannot send that
    without a CORS preflight (CSRF mitigation until session auth lands)."""

    auto_scope = True

    def initial(self, request: Request, *args: Any, **kwargs: Any) -> None:
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            ctype = request.content_type.split(";")[0].strip().lower()
            if ctype != "application/json":
                raise ApiError(415, "unsupported_media_type", "Send JSON.")
        if self.auto_scope and getattr(self, "throttle_scope", None) is None:
            safe = request.method in ("GET", "HEAD", "OPTIONS")
            self.throttle_scope = "reads" if safe else "writes"
        super().initial(request, *args, **kwargs)


def iso(dt: datetime | None) -> str | None:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


def synced_at() -> str | None:
    run = last_sync_ok()
    return iso(run.finished_at) if run else None


def parse_date(value: str, name: str) -> date:
    if not DATE_RE.match(value):
        raise ApiError(400, "invalid_date", f"{name} must be YYYY-MM-DD.")
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ApiError(400, "invalid_date", f"{name} must be a real date.") from None


def encode_cursor(posted_on: date, txn_id: str) -> str:
    return base64.urlsafe_b64encode(f"{posted_on.isoformat()}|{txn_id}".encode()).decode()


def decode_cursor(value: str) -> tuple[date, str]:
    try:
        raw = base64.urlsafe_b64decode(value.encode("ascii")).decode("ascii")
        day, _, txn_id = raw.partition("|")
        if not DATE_RE.match(day) or not TXN_ID_RE.match(txn_id):
            raise ValueError
        return date.fromisoformat(day), txn_id
    except ValueError, binascii.Error, UnicodeError:
        raise ApiError(400, "invalid_cursor", "That page cursor isn't valid.") from None


def get_visible_txn(request: Request, txn_id: str) -> Transaction:
    try:
        validate_txn_id(txn_id)
    except InvalidTransactionId:
        raise ApiError(404, "not_found", "Transaction not found.") from None
    txn = Transaction.objects.for_member(request.user).filter(pk=txn_id).first()
    if txn is None:
        raise ApiError(404, "not_found", "Transaction not found.")
    return txn


class TransactionListView(LedgerView):
    @extend_schema(
        operation_id="listTransactions",
        parameters=[
            OpenApiParameter("category", str, many=True, description="key, or `uncategorized`"),
            OpenApiParameter("from", str, description="YYYY-MM-DD, inclusive"),
            OpenApiParameter("to", str, description="YYYY-MM-DD, inclusive"),
            OpenApiParameter("status", str, enum=["pending", "posted"]),
            OpenApiParameter("account", str),
            OpenApiParameter("q", str, description="merchant/description contains"),
            OpenApiParameter("cursor", str),
            OpenApiParameter("limit", int, description="1..200, default 50"),
        ],
        responses={200: TransactionListSerializer, 400: ErrorSerializer},
    )
    def get(self, request: Request) -> Response:
        maybe_sync_if_stale()
        qp = request.query_params
        qs = Transaction.objects.for_member(request.user)

        keys = [k.strip() for raw in qp.getlist("category") for k in raw.split(",") if k.strip()]
        if keys:
            cond = Q(category__in=[k for k in keys if k != "uncategorized"])
            if "uncategorized" in keys:
                cond |= Q(category__isnull=True)
            qs = qs.filter(cond)
        if qp.get("from"):
            qs = qs.filter(posted_on__gte=parse_date(qp["from"], "from"))
        if qp.get("to"):
            qs = qs.filter(posted_on__lte=parse_date(qp["to"], "to"))
        if qp.get("status"):
            if qp["status"] not in ("pending", "posted"):
                raise ApiError(400, "invalid_status", "status must be pending or posted.")
            qs = qs.filter(status=qp["status"])
        if qp.get("account"):
            qs = qs.filter(account_id=qp["account"])
        if qp.get("q"):
            qs = qs.filter(Q(merchant__icontains=qp["q"]) | Q(description__icontains=qp["q"]))

        try:
            limit = int(qp.get("limit", "50"))
        except ValueError:
            limit = 0
        if not 1 <= limit <= 200:
            raise ApiError(400, "invalid_limit", "limit must be between 1 and 200.")

        if qp.get("cursor"):
            c_day, c_id = decode_cursor(qp["cursor"])
            qs = qs.filter(Q(posted_on__lt=c_day) | Q(posted_on=c_day, id__lt=c_id))

        rows = list(qs.order_by("-posted_on", "-id")[: limit + 1])
        page = rows[:limit]
        nxt = encode_cursor(page[-1].posted_on, page[-1].pk) if len(rows) > limit else None
        data = {
            "results": TransactionSerializer(page, many=True).data,
            "next_cursor": nxt,
            "synced_at": synced_at(),
        }
        return Response(data)


class TransactionDetailView(LedgerView):
    @extend_schema(
        operation_id="getTransaction",
        responses={200: TransactionSerializer, 404: ErrorSerializer},
    )
    def get(self, request: Request, txn_id: str) -> Response:
        return Response(TransactionSerializer(get_visible_txn(request, txn_id)).data)

    @extend_schema(
        operation_id="updateTransaction",
        request=TransactionPatchSerializer,
        responses={200: TransactionSerializer, **ERRORS},
    )
    def patch(self, request: Request, txn_id: str) -> Response:
        get_visible_txn(request, txn_id)  # id validation + 404
        ser = TransactionPatchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        body = ser.validated_data
        client = LedgerlyClient()
        error: ApiError | None = None
        result: Transaction | None = None

        # The row lock is taken BEFORE the stale check and held through the vendor PUT and the
        # save, so concurrent PATCHes on one row serialize (and a sync's race guard sees our
        # local_write_at). Errors that must leave side effects (tombstone, unconfirmed) are
        # recorded in `error` and raised after the transaction commits.
        with transaction.atomic():
            txn = (
                Transaction.objects.for_member(request.user)
                .select_for_update()
                .filter(pk=txn_id)
                .first()
            )
            if txn is None:
                raise ApiError(404, "not_found", "Transaction not found.")

            expected = body.get("expected_updated_at")
            if expected is not None and expected != txn.vendor_updated_at:
                raise ApiError(409, "stale", STALE_MESSAGE)

            wanted: dict[str, Any] = {}
            if "category" in body:
                wanted["category"] = body["category"]
            if "description" in body:
                wanted["description"] = body["description"]
            fields = {k: v for k, v in wanted.items() if getattr(txn, k) != v}
            if not fields:  # trap 28: never PUT a no-op (it would bump the vendor's updated_at)
                return Response(TransactionSerializer(txn).data)
            category = fields.get("category")
            if category is not None and not is_valid_category(category):
                raise ApiError(400, "invalid_category", "Pick a category from the list.")

            try:
                # Freshness check against the vendor itself (reviewer 3c). Limitation (3b): the
                # vendor's updated_at has one-second resolution, so two changes inside the same
                # second are indistinguishable; last write wins there.
                current = validate_vendor_row(client.get(txn.pk))
                if isinstance(current, dict) and current["vendor_updated_at"] != (
                    txn.vendor_updated_at
                ):
                    raise ApiError(409, "stale", STALE_MESSAGE)
                vendor_row = client.update(txn.pk, fields)
            except VendorUnavailable:
                raise ApiError(502, "vendor_unavailable", DOWN_MESSAGE) from None
            except VendorNotFound:
                now = timezone.now()
                Transaction.objects.filter(pk=txn.pk).update(deleted_at=now)
                AuditEvent.objects.create(
                    actor=actor_label(request),
                    action="tombstoned",
                    txn_id=txn.pk,
                    request_id=request_id_of(request),
                    ip=client_ip(request),
                )
                DataVersion.bump()
                error = ApiError(404, "not_found", "Transaction not found.")
            except VendorRejected:
                raise ApiError(
                    502,
                    "vendor_rejected",
                    "Your bank feed didn't accept that change. Nothing changed.",
                ) from None
            else:
                clean = validate_vendor_row(vendor_row)
                if isinstance(clean, str) or clean["id"] != txn.pk:
                    # The PUT succeeded but we can't trust the reply: re-read and re-sync it.
                    refresh_row(client, txn.pk)
                    error = ApiError(
                        502,
                        "vendor_unconfirmed",
                        "Your change may have been saved. Refresh to check.",
                    )
                else:
                    before = {k: getattr(txn, k) for k in fields}
                    for f, value in clean.items():
                        setattr(txn, f, value)
                    txn.local_write_at = timezone.now()
                    txn.missing_since = None
                    txn.deleted_at = None
                    txn.save()
                    AuditEvent.objects.create(
                        actor=actor_label(request),
                        action="recategorize" if "category" in fields else "describe",
                        txn_id=txn.pk,
                        before=before,
                        after={k: getattr(txn, k) for k in fields},
                        request_id=request_id_of(request),
                        ip=client_ip(request),
                    )
                    DataVersion.bump()
                    result = txn
        if error is not None:
            raise error
        assert result is not None  # noqa: S101
        return Response(TransactionSerializer(result).data)


class TransactionHistoryView(LedgerView):
    @extend_schema(
        operation_id="getTransactionHistory",
        responses={200: HistorySerializer, 404: ErrorSerializer},
    )
    def get(self, request: Request, txn_id: str) -> Response:
        txn = get_visible_txn(request, txn_id)
        events = AuditEvent.objects.filter(txn_id=txn.pk)
        # Trap 15: history starts at the latest "replaced" event (the id was reused/revived).
        replaced_id = (
            events.filter(action="replaced").order_by("-id").values_list("id", flat=True).first()
        )
        if replaced_id is not None:
            events = events.filter(id__gte=replaced_id)
        events = events.order_by("-at", "-id")
        results = [
            {
                "at": e.at,
                "actor": e.actor if e.actor == "sync" else "you",
                "action": e.action,
                "before": e.before,
                "after": e.after,
            }
            for e in events
        ]
        return Response({"results": results})


class SummaryView(LedgerView):
    @extend_schema(
        operation_id="getSummary",
        parameters=[OpenApiParameter("month", str, required=True, description="YYYY-MM")],
        responses={200: SummarySerializer, 304: None, 400: ErrorSerializer},
    )
    def get(self, request: Request) -> Response | HttpResponse:
        month = request.query_params.get("month", "")
        if not MONTH_RE.match(month):
            raise ApiError(400, "invalid_month", "month must look like 2026-10.")
        maybe_sync_if_stale()

        last_ok = last_sync_ok()  # in the ETag so the body's synced_at is never frozen
        tag = f"{month}:{DataVersion.current()}:{last_ok.pk if last_ok else 0}"
        etag = '"' + hashlib.sha256(tag.encode()).hexdigest()[:24] + '"'
        if etag in [t.strip() for t in request.headers.get("If-None-Match", "").split(",")]:
            resp = HttpResponse(status=304)
        else:
            resp = Response(self._build(request, month))
        resp["ETag"] = etag
        resp["Cache-Control"] = "private, no-cache"
        return resp

    @staticmethod
    def _build(request: Request, month: str) -> dict[str, Any]:
        year, mon = int(month[:4]), int(month[5:])
        first = date(year, mon, 1)
        nxt = date(year + (mon == 12), mon % 12 + 1, 1)
        scoped = Transaction.objects.for_member(request.user)

        # ONE grouped aggregate; signs are applied afterwards by money.signed_cents.
        groups = (
            scoped.filter(posted_on__gte=first, posted_on__lt=nxt)
            .values("category", "status", "currency", "direction")
            .annotate(total=Sum("amount_cents"), n=Count("id"))
        )

        income = spend = pending = pending_n = pending_income = 0
        unc_credit = unc_credit_n = unc_n = excluded_n = 0
        per_cat: dict[str | None, list[int]] = defaultdict(lambda: [0, 0])
        for g in groups:
            total, n, cat = int(g["total"] or 0), g["n"], g["category"]
            if g["currency"] != "USD":
                excluded_n += n
                continue
            if cat is None:
                unc_n += n
            kind = classify(cat, g["direction"], g["currency"])
            signed = signed_cents(total, g["direction"])
            if g["status"] == "pending":
                # Classify first; transfers don't count; refunds net against pending spend.
                if kind == "transfer":
                    continue
                pending_n += n
                if kind == "income":
                    pending_income += signed
                elif kind in ("spend", "refund"):
                    pending -= signed
                continue
            if kind == "income":
                income += signed
            elif kind == "uncategorized_credit":
                unc_credit += total
                unc_credit_n += n
            elif kind in ("spend", "refund"):
                spend -= signed
                per_cat[cat][0] -= signed
                per_cat[cat][1] += n

        ordered = sorted(per_cat.items(), key=lambda kv: (-kv[1][0], label_for(kv[0])))
        by_category = [
            {
                "category": cat,
                "label": UNCATEGORIZED_LABEL if cat is None else label_for(cat),
                "spend_cents": v[0],
                "count": v[1],
            }
            for cat, v in ordered
        ]

        latest = scoped.filter(status="posted", currency="USD").aggregate(m=Max("posted_on"))["m"]
        return {
            "month": month,
            "income_cents": income,
            "spend_cents": spend,
            "net_cents": income - spend,
            "pending_cents": pending,
            "pending_income_cents": pending_income,
            "pending_count": pending_n,
            "uncategorized_count": unc_n,
            "uncategorized_credit_cents": unc_credit,
            "uncategorized_credit_count": unc_credit_n,
            "excluded_currency_count": excluded_n,
            "by_category": by_category,
            "latest_month_with_data": latest.strftime("%Y-%m") if latest else None,
            "synced_at": synced_at(),
        }


class CategoriesView(LedgerView):
    @extend_schema(operation_id="listCategories", responses={200: CategoryListSerializer})
    def get(self, request: Request) -> Response:
        results = [
            {
                "key": c.key,
                "label": c.label,
                "schedule_c_line": c.schedule_c_line,
                "deductible_fraction": float(c.deductible_fraction),
                "kind": c.kind,
            }
            for c in CATEGORIES.values()
        ]
        return Response({"results": results})


class SyncView(LedgerView):
    throttle_scope = "sync"

    @extend_schema(
        operation_id="runSync",
        request=None,
        responses={200: SyncResultSerializer, 409: ErrorSerializer, 502: ErrorSerializer},
    )
    def post(self, request: Request) -> Response:
        run = sync_with_lock()
        if run is None:
            raise ApiError(409, "sync_running", "A refresh is already running.")
        if run.status != "ok":
            raise ApiError(
                502,
                "vendor_unavailable",
                "We couldn't reach your bank feed. Showing your last synced data.",
            )
        return Response(
            {
                "status": "ok",
                "fetched": run.fetched,
                "upserted": run.upserted,
                "rejected": run.rejected,
                "tombstoned": run.tombstoned,
                "finished_at": run.finished_at,
            }
        )


class SyncStatusView(LedgerView):
    @extend_schema(operation_id="getSyncStatus", responses={200: SyncStatusSerializer})
    def get(self, request: Request) -> Response:
        now = timezone.now()
        latest = SyncRun.objects.order_by("-started_at").first()
        ok = last_sync_ok()
        if latest is None:
            state = "never"
        elif latest.status == "running" and now - latest.started_at < RUNNING_FRESH:
            state = "running"
        elif latest.status == "failed":
            state = "vendor_down"
        else:
            state = "ok"
        last_success = ok.finished_at if ok else None
        return Response(
            {
                "last_success_at": last_success,
                "last_attempt_at": latest.started_at if latest else None,
                "state": state,
                "stale": last_success is None or now - last_success > STALE_AFTER,
                "rejected_count": SyncRejection.objects.count(),
            }
        )


class HealthView(LedgerView):
    permission_classes = [AllowAny]
    auto_scope = False  # liveness probes are not throttled

    @extend_schema(
        operation_id="getHealth", responses={200: HealthSerializer, 503: HealthSerializer}
    )
    def get(self, request: Request) -> Response:
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
            db = "ok"
        except Exception:  # noqa: BLE001 - health must report, not raise
            db = "error"
        vendor = "ok" if LedgerlyClient(timeout=2, retries=0).health() else "down"
        if db == "error":
            return Response(
                {"status": "degraded", "db": db, "vendor": vendor},
                status=http.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {"status": "ok" if vendor == "ok" else "degraded", "db": db, "vendor": vendor}
        )


class PingView(HealthView):
    """Legacy alias of /api/health; kept out of the schema."""

    @extend_schema(exclude=True)
    def get(self, request: Request) -> Response:
        return super().get(request)
