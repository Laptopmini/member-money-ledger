import time

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from ledger import flags
from ledger.members import DEMO_EMAIL, DEV_DEFAULT_PASSWORD

CREDS = {"email": DEMO_EMAIL, "password": DEV_DEFAULT_PASSWORD}


@pytest.fixture
def auth_on():
    flags.TEST_OVERRIDES = {"auth-required": True}


def login(api=None):
    api = api or APIClient()
    r = api.post("/api/auth/login", CREDS, format="json")
    assert r.status_code == 200, r.content
    return api


def test_member_seeded(db):
    assert get_user_model().objects.filter(email=DEMO_EMAIL).exists()


def test_requires_login_when_flag_on(db, auth_on):
    r = APIClient().get("/api/categories")
    assert r.status_code == 401 and r.json()["error"]["code"] == "not_authenticated"
    assert APIClient().get("/api/health").status_code == 200
    assert APIClient().get("/api/auth/csrf").status_code == 200
    assert APIClient().get("/api/flags").status_code == 200


def test_flag_evaluated_server_side(db):
    """Trap 25: flipping the flag changes enforcement with no client involvement."""
    api = APIClient()
    flags.TEST_OVERRIDES = {"auth-required": False}
    assert api.get("/api/categories").status_code == 200
    flags.TEST_OVERRIDES = {"auth-required": True}
    assert api.get("/api/categories").status_code == 401


def test_login_logout_me(db, auth_on):
    api = login()
    assert api.get("/api/categories").status_code == 200
    me = api.get("/api/auth/me").json()
    assert me["user"] == {"email": DEMO_EMAIL, "name": "Sam"}
    assert me["idle_timeout_seconds"] == 900 and 890 <= me["expires_in_seconds"] <= 900
    assert api.post("/api/auth/logout", {}, format="json").status_code == 200
    assert api.get("/api/auth/me").status_code == 401


def test_bad_credentials(db, auth_on):
    r = APIClient().post(
        "/api/auth/login", {"email": DEMO_EMAIL, "password": "nope"}, format="json"
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_credentials"


def test_login_throttle_per_ip(db, auth_on):
    api = APIClient()
    codes = [
        api.post(
            "/api/auth/login", {"email": f"u{i}@x.com", "password": "x"}, format="json"
        ).status_code
        for i in range(6)
    ]
    assert codes[:5] == [400] * 5 and codes[5] == 429


def test_login_throttle_per_username(db, auth_on):
    cache.clear()
    codes = []
    for i in range(21):
        api = APIClient(REMOTE_ADDR=f"10.0.0.{i}")
        codes.append(
            api.post(
                "/api/auth/login", {"email": "a@x.com", "password": "x"}, format="json"
            ).status_code
        )
    assert 429 not in codes[:20] and codes[20] == 429


def test_csrf_enforced_for_signed_in_writes(db, auth_on):
    api = APIClient(enforce_csrf_checks=True)
    api.get("/api/auth/csrf")
    token = api.cookies["csrftoken"].value
    r = api.post("/api/auth/login", CREDS, format="json", HTTP_X_CSRFTOKEN=token)
    assert r.status_code == 200
    r = api.post("/api/sync", {}, format="json")
    assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"


def test_login_requires_csrf(db, auth_on):
    r = APIClient(enforce_csrf_checks=True).post("/api/auth/login", CREDS, format="json")
    assert r.status_code == 403


def _age(api, seconds):
    s = api.session
    s["last_activity"] = int(time.time()) - seconds
    s.save()


def test_idle_timeout_expires_session(db, auth_on):
    api = login()
    _age(api, 901)
    r = api.get("/api/categories")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "session_expired"
    assert "15 minutes" in r.json()["error"]["message"]
    assert api.get("/api/categories").json()["error"]["code"] == "not_authenticated"


def test_poll_does_not_extend_session(db, auth_on):
    """Trap 18: only X-User-Activity: 1 refreshes last_activity; /me never does."""
    api = login()
    _age(api, 600)
    api.get("/api/categories")  # background poll
    api.get("/api/auth/me", HTTP_X_USER_ACTIVITY="1")  # even flagged, /me must not refresh
    left = api.get("/api/auth/me").json()["expires_in_seconds"]
    assert left <= 300
    api.get("/api/categories", HTTP_X_USER_ACTIVITY="1")
    assert api.get("/api/auth/me").json()["expires_in_seconds"] >= 890


def test_audit_actor_is_user_email(db, auth_on):
    from ledger.views import actor_label

    class R:
        user = get_user_model().objects.get(email=DEMO_EMAIL)

    assert actor_label(R()) == DEMO_EMAIL  # type: ignore[arg-type]
