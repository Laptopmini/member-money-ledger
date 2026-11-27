"""One error envelope for every failure: {"error": {"code", "message", "request_id"}}."""

import logging
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
    if isinstance(exc, exceptions.ParseError):
        code = "bad_request"
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
