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
    """20/hour per (posted email, IP), counting FAILED logins only: a correct password is never
    blocked by earlier failures from elsewhere, and failures can't lock an account for everyone."""

    scope = "login_user"
    duration: int
    num_requests: int

    def get_cache_key(self, request: Request, view: Any) -> str | None:
        data = request.data
        email = data.get("email", "") if isinstance(data, dict) else ""
        raw = f"{str(email).strip().lower()}|{self.get_ident(request)}"
        return self.cache_format % {
            "scope": self.scope,
            "ident": hashlib.sha256(raw.encode()).hexdigest()[:32],
        }

    def allow_request(self, request: Request, view: Any) -> bool:
        if self.rate is None:
            return True
        self.key = self.get_cache_key(request, view)
        if self.key is None:
            return True
        self.history = self.cache.get(self.key, [])
        self.now = self.timer()
        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()
        return len(self.history) < self.num_requests or self.throttle_failure()

    def record_failure(self, request: Request, view: Any) -> None:
        if self.rate is None:
            return
        key = self.get_cache_key(request, view)
        if key is None:
            return
        now = self.timer()
        history = [t for t in self.cache.get(key, []) if t > now - self.duration]
        history.insert(0, now)
        self.cache.set(key, history, self.duration)
