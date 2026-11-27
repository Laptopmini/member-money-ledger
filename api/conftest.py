"""Root test config: no flagd network in tests; auth off unless a test turns it on."""

from collections.abc import Iterator

import pytest

from ledger import flags


@pytest.fixture(autouse=True)
def _flags_offline() -> Iterator[None]:
    flags.TEST_OVERRIDES = {"auth-required": False}
    from django.core.cache import cache

    cache.clear()
    yield
    flags.TEST_OVERRIDES = None
