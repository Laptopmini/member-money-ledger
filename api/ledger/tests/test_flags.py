import pytest
from rest_framework.test import APIClient

from ledger import flags


def test_defaults():
    assert flags.DEFAULTS == {
        "tax-set-aside": True,
        "auth-required": True,
        "merchant-rules": False,
        "category-suggestions": False,
    }


def test_flag_falls_back_when_flagd_unreachable(monkeypatch):
    flags.TEST_OVERRIDES = None
    flags._cache.clear()
    monkeypatch.setattr(flags, "_down_until", 0.0)

    def boom(key, default):
        raise ConnectionError("flagd down")

    monkeypatch.setattr(flags, "_evaluate", boom)
    assert flags.flag("tax-set-aside") is True
    assert flags.flag("merchant-rules") is False
    assert flags.flag("anything-else", True) is True


def test_flag_uses_provider_value(monkeypatch):
    flags.TEST_OVERRIDES = None
    flags._cache.clear()
    monkeypatch.setattr(flags, "_down_until", 0.0)
    monkeypatch.setattr(flags, "_evaluate", lambda key, default: not default)
    assert flags.flag("merchant-rules") is True


@pytest.mark.django_db
def test_flags_endpoint_is_open_and_server_evaluated():
    flags.TEST_OVERRIDES = {"auth-required": True, "merchant-rules": True}
    r = APIClient().get("/api/flags")
    assert r.status_code == 200
    assert r.json() == {
        "tax-set-aside": True,
        "auth-required": True,
        "merchant-rules": True,
        "category-suggestions": False,
    }
