import re
import time
import uuid
from collections.abc import Callable

from django.http import HttpRequest, HttpResponse

_SAFE_ID = re.compile(r"\A[A-Za-z0-9._-]{1,64}\Z")


class RequestIdMiddleware:
    """Accept an inbound X-Request-ID (if sane), else mint one; echo it on the response."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        incoming = request.headers.get("X-Request-ID", "")
        request_id = incoming if _SAFE_ID.match(incoming) else uuid.uuid4().hex
        request.request_id = request_id  # type: ignore[attr-defined]
        response = self.get_response(request)
        response["X-Request-ID"] = request_id
        return response


OPEN_PATHS = {"/api/auth/login", "/api/auth/csrf", "/api/health", "/api/ping", "/api/flags"}
NO_REFRESH_PATHS = {"/api/auth/me"}  # trap 18: asking "how long left?" must not extend it


class IdleTimeoutMiddleware:
    """15-minute idle timeout. `last_activity` lives in the session and is refreshed ONLY by
    requests carrying `X-User-Activity: 1` (and by login); background polls never extend it."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        from django.conf import settings

        from .errors import json_error

        user = getattr(request, "user", None)
        path = request.path
        if user is not None and user.is_authenticated and path not in OPEN_PATHS:
            now = int(time.time())
            last = request.session.get("last_activity")
            if last is None or now - int(last) > settings.IDLE_TIMEOUT_SECONDS:
                request.session.flush()
                return json_error(
                    request,
                    401,
                    "session_expired",
                    "You were signed out after 15 minutes of inactivity.",
                )
            if request.headers.get("X-User-Activity") == "1" and path not in NO_REFRESH_PATHS:
                request.session["last_activity"] = now
        return self.get_response(request)
