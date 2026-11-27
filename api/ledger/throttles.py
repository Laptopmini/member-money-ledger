import hashlib
from typing import Any

from rest_framework.request import Request
from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle


class ScopedUserThrottle(ScopedRateThrottle):
    """Scoped rate limit keyed by user id when signed in, else by client IP."""

    def get_cache_key(self, request: Request, view: Any) -> str | None:
        scope = getattr(view, "throttle_scope", None)
        if not scope:
            return None
        self.scope = scope
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)
        user = getattr(request, "user", None)
        ident = (
            f"u{user.pk}" if user is not None and user.is_authenticated else self.get_ident(request)
        )
        return self.cache_format % {"scope": scope, "ident": ident}


class LoginIPThrottle(SimpleRateThrottle):
    scope = "login_ip"

    def get_cache_key(self, request: Request, view: Any) -> str | None:
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class LoginUserThrottle(SimpleRateThrottle):
    """20/hour per posted email, so one account can't be ground down from many IPs."""

    scope = "login_user"

    def get_cache_key(self, request: Request, view: Any) -> str | None:
        data = request.data
        email = data.get("email", "") if isinstance(data, dict) else ""
        digest = hashlib.sha256(str(email).strip().lower().encode()).hexdigest()[:32]
        return self.cache_format % {"scope": self.scope, "ident": digest}
