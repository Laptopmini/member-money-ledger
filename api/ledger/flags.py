"""Feature flags via OpenFeature + flagd (ADR 0008). Evaluated server-side; the web only mirrors.

`flag()` never raises and never blocks for long: results are cached for a few seconds, and a
failed provider setup/evaluation falls back to the code default (and is not retried for 30 s).
"""

import logging
import os
import time

log = logging.getLogger(__name__)

DEFAULTS: dict[str, bool] = {
    "tax-set-aside": True,
    "auth-required": True,
    "merchant-rules": False,
    "category-suggestions": False,
}
CACHE_SECONDS = 5.0
RETRY_AFTER_FAILURE = 30.0

# Test hook: when set, flag() answers from this dict (falling back to DEFAULTS), no network.
TEST_OVERRIDES: dict[str, bool] | None = None

_cache: dict[str, tuple[float, bool]] = {}
_provider_ready = False
_down_until = 0.0


def _evaluate(key: str, default: bool) -> bool:
    """Ask flagd. Raises on any failure (caller handles)."""
    global _provider_ready
    from openfeature import api
    from openfeature.contrib.provider.flagd import FlagdProvider

    if not _provider_ready:
        api.set_provider(
            FlagdProvider(
                host=os.environ.get("FLAGD_HOST", "flagd"),
                port=int(os.environ.get("FLAGD_PORT", "8013")),
                deadline_ms=500,
                timeout=1,
            )
        )
        _provider_ready = True
    return bool(api.get_client().get_boolean_value(key, default))


def flag(key: str, default: bool | None = None) -> bool:
    global _down_until
    fallback = DEFAULTS.get(key, False) if default is None else default
    if TEST_OVERRIDES is not None:
        return TEST_OVERRIDES.get(key, fallback)
    now = time.monotonic()
    hit = _cache.get(key)
    if hit and now - hit[0] < CACHE_SECONDS:
        return hit[1]
    if now < _down_until:
        return fallback
    try:
        value = _evaluate(key, fallback)
    except Exception as exc:  # noqa: BLE001 - flags must never break a request
        _down_until = now + RETRY_AFTER_FAILURE
        log.warning("flag_fallback key=%s type=%s", key, type(exc).__name__)
        return fallback
    _cache[key] = (now, value)
    return value


def all_flags() -> dict[str, bool]:
    return {key: flag(key, default) for key, default in DEFAULTS.items()}
