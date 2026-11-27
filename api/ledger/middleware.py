import re
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
