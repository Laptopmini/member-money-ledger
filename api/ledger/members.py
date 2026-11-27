"""The single seeded member (ADR 0009)."""

import os
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model

DEMO_EMAIL = "member@example.com"
DEMO_NAME = "Sam"
DEV_DEFAULT_PASSWORD = "demo-password-2026"  # noqa: S105 - dev only


def demo_password() -> str | None:
    """From DEMO_MEMBER_PASSWORD; the dev default only exists when DEBUG=1."""
    return os.environ.get("DEMO_MEMBER_PASSWORD") or (
        DEV_DEFAULT_PASSWORD if settings.ALLOW_DEV_DEFAULTS else None
    )


def ensure_member(reset_password: bool = False) -> Any | None:
    """Create the member (idempotent). Returns None if there is no password to set in prod."""
    user_model = get_user_model()
    password = demo_password()
    user = user_model.objects.filter(username=DEMO_EMAIL).first()
    if user is None:
        if password is None:
            return None
        user = user_model(username=DEMO_EMAIL, email=DEMO_EMAIL, first_name=DEMO_NAME)
        user.set_password(password)
        user.save()
    elif reset_password and password is not None:
        user.set_password(password)
        user.save()
    return user


def member_for(request: Any) -> Any:
    """The member a request acts as: the signed-in user, or (auth flag off) the seeded member."""
    user = getattr(request, "user", None)
    if user is not None and user.is_authenticated:
        return user
    return ensure_member()


def display_name(user: Any) -> str:
    return str(user.first_name or user.email or user.username)
