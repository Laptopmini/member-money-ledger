"""One error envelope for every failure: {"error": {"code", "message", "request_id"}}."""

import logging
import math
from typing import Any

from django.http import Http404, HttpRequest, JsonResponse
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

log = logging.getLogger(__name__)


class ApiError(exceptions.APIException):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(detail=message, code=code)
        self.status_code = status_code
        self.code = code
        self.message = message


def request_id_of(request: Any) -> str:
    inner = getattr(request, "_request", request)
    return str(getattr(inner, "request_id", ""))


def envelope(code: str, message: str, request_id: str) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "request_id": request_id}}


_DEFAULTS: dict[int, tuple[str, str]] = {
    400: ("bad_request", "That request wasn't valid."),
    401: ("not_authenticated", "Please sign in."),
    403: ("forbidden", "You can't do that."),
    404: ("not_found", "Not found."),
    405: ("method_not_allowed", "That method isn't allowed here."),
    406: ("not_acceptable", "Not acceptable."),
    415: ("unsupported_media_type", "Send JSON."),
    429: ("throttled", "Too many requests. Try again shortly."),
}


def throttle_message(wait: float | None) -> str:
    if wait is None:
        return "Too many attempts. Try again shortly."
    seconds = math.ceil(wait)
    if seconds > 90:
        minutes = math.ceil(seconds / 60)
        return f"Too many attempts. Try again in {minutes} minutes."
    return f"Too many attempts. Try again in {seconds} seconds."


def exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    request = context.get("request")
    rid = request_id_of(request)
    if isinstance(exc, ApiError):
        return Response(envelope(exc.code, exc.message, rid), status=exc.status_code)
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    response = drf_exception_handler(exc, context)
    if response is None:
        log.error("unhandled_error type=%s request_id=%s", type(exc).__name__, rid, exc_info=exc)
        return Response(
            envelope("server_error", "Something went wrong on our side.", rid), status=500
        )
    code, message = _DEFAULTS.get(response.status_code, ("error", "Request failed."))
    if response.status_code == 403 and "CSRF" in str(getattr(exc, "detail", "")):
        code, message = "csrf_failed", "Your session check failed. Reload the page and try again."
    if isinstance(exc, exceptions.ParseError):
        code = "bad_request"
    if isinstance(exc, exceptions.Throttled):
        message = getattr(context.get("view"), "throttle_message", None) or throttle_message(
            getattr(exc, "wait", None)
        )
    response.data = envelope(code, message, rid)
    return response


def json_error(request: HttpRequest, status: int, code: str, message: str) -> JsonResponse:
    return JsonResponse(
        envelope(code, message, str(getattr(request, "request_id", ""))), status=status
    )


def handler404(request: HttpRequest, exception: Exception | None = None) -> JsonResponse:
    return json_error(request, 404, "not_found", "Not found.")


def handler500(request: HttpRequest) -> JsonResponse:
    return json_error(request, 500, "server_error", "Something went wrong on our side.")


def handler400(request: HttpRequest, exception: Exception | None = None) -> JsonResponse:
    return json_error(request, 400, "bad_request", "That request wasn't valid.")
