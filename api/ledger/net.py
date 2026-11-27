from typing import Any

from django.conf import settings


def client_ip(request: Any) -> str | None:
    """REMOTE_ADDR, unless TRUST_PROXY=1 (Caddy in front): then the last X-Forwarded-For hop,
    which is the one our own proxy appended. Never trusted otherwise (spoofable)."""
    meta = request._request.META if hasattr(request, "_request") else request.META
    if settings.TRUST_PROXY:
        xff = meta.get("HTTP_X_FORWARDED_FOR", "")
        if xff:
            return str(xff.split(",")[-1].strip()) or None
    return str(meta.get("REMOTE_ADDR") or "") or None
