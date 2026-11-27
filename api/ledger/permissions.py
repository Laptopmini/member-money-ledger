from typing import Any

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from .flags import flag


class SessionAuth401(SessionAuthentication):
    """Session auth with CSRF enforced; the auth header makes DRF answer 401 (not 403)."""

    def authenticate_header(self, request: Request) -> str:
        return "Session"


class AuthIfFlagOn(BasePermission):
    """Require a signed-in member only while the `auth-required` flag is on. The flag is
    evaluated here, server-side, on every request (trap 25): the UI only mirrors it."""

    def has_permission(self, request: Request, view: Any) -> bool:
        if not flag("auth-required"):
            return True
        return bool(request.user and request.user.is_authenticated)


def csrf_check(request: Request) -> None:
    """Enforce CSRF on a view whose caller is not yet authenticated (login)."""
    SessionAuthentication().enforce_csrf(request)
