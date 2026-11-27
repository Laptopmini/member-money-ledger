"""Root test config: no flagd network in tests; auth off unless a test turns it on."""

from collections.abc import Iterator
from typing import Any

import pytest

from ledger import flags


@pytest.fixture(autouse=True)
def _flags_offline(settings: Any) -> Iterator[None]:
    flags.TEST_OVERRIDES = {"auth-required": False}
    # Production throttles use the shared DB cache; tests use locmem (no DB access needed).
    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    from django.core.cache import cache

    cache.clear()
    yield
    flags.TEST_OVERRIDES = None
