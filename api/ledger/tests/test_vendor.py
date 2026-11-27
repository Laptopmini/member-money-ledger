"""LedgerlyClient against a patched urllib.request.urlopen (no network)."""

import email.message
import io
import json
import urllib.error
import urllib.request

import pytest

from ledger.vendor import (
    InvalidTransactionId,
    LedgerlyClient,
    VendorNotFound,
    VendorUnavailable,
    validate_txn_id,
)

HDRS = email.message.Message()


class Resp:
    def __init__(self, body: bytes | dict, status: int = 200):
        self._b = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.status = status

    def read(self):
        return self._b

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture
def urlopen(monkeypatch):
    """Records (url, method, timeout, body); `script` is a list of Resp | Exception."""
    state: dict[str, list] = {"calls": [], "script": []}

    def fake(req, timeout=None, **kw):
        state["calls"].append(
            {"url": req.full_url, "method": req.get_method(), "timeout": timeout, "data": req.data}
        )
        item = (
            state["script"].pop(0) if state["script"] else Resp({"data": [], "next_cursor": None})
        )
        if isinstance(item, Exception):
            raise item
        return item

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    return state


@pytest.fixture
def client():
    return LedgerlyClient(base_url="http://vendor:8080", timeout=3, retries=2)


@pytest.mark.parametrize(
    "bad", ["../x", "txn_é", "a/b", "", "txn 1", "x" * 65, "a?b=1", "..", None, 5]
)
def test_rejects_bad_ids(bad):
    """Trap 9: strict ASCII id regex before any URL is built."""
    with pytest.raises(InvalidTransactionId):
        validate_txn_id(bad)


@pytest.mark.parametrize("bad", ["../x", "txn_é", "a/b", ""])
def test_client_never_calls_vendor_for_bad_ids(client, urlopen, bad):
    """Trap 9: get/update refuse before any request is made."""
    with pytest.raises(InvalidTransactionId):
        client.get(bad)
    with pytest.raises(InvalidTransactionId):
        client.update(bad, {"category": "meals"})
    assert urlopen["calls"] == []


def test_good_ids_pass():
    assert validate_txn_id("txn_000001") == "txn_000001"


def test_non_json_and_reset_retried(client, urlopen):
    """Trap 17: non-JSON / dropped connections -> VendorUnavailable after bounded retries."""
    urlopen["script"] = [Resp(b"<html>oops"), ConnectionResetError("reset"), Resp(b"not json")]
    with pytest.raises(VendorUnavailable):
        client.list_page(None)
    assert len(urlopen["calls"]) == 3  # 1 + retries(2), bounded


def test_retry_then_success(client, urlopen):
    """Trap 17: a transient reset is retried and recovered."""
    urlopen["script"] = [ConnectionResetError("reset"), Resp({"data": [], "next_cursor": None})]
    rows, nxt = client.list_page(None)
    assert rows == [] and nxt is None
    assert len(urlopen["calls"]) == 2


def test_url_error_is_unavailable(client, urlopen):
    urlopen["script"] = [urllib.error.URLError("refused")] * 3
    with pytest.raises(VendorUnavailable):
        client.get("txn_000001")


def test_404_is_not_found_and_not_retried(client, urlopen):
    urlopen["script"] = [
        urllib.error.HTTPError("u", 404, "nf", HDRS, io.BytesIO(b'{"error":{"code":"not_found"}}'))
    ]
    with pytest.raises(VendorNotFound):
        client.get("txn_000099")
    assert len(urlopen["calls"]) == 1


def test_error_message_does_not_leak_vendor_text(client, urlopen):
    """Trap 8: vendor text never surfaces in exceptions."""
    body = b'{"error":{"message":"SECRET-VENDOR-TEXT"}}'
    urlopen["script"] = [urllib.error.HTTPError("u", 500, "x", HDRS, io.BytesIO(body))] * 3
    with pytest.raises(VendorUnavailable) as exc:
        client.get("txn_000001")
    assert "SECRET-VENDOR-TEXT" not in str(exc.value)


def test_timeout_passed_to_urlopen(client, urlopen):
    client.get("txn_000001")
    urlopen["script"] = [Resp({"id": "txn_000001"})]
    client.get("txn_000001")
    assert all(c["timeout"] == 3 for c in urlopen["calls"])


def test_list_always_limit_100(client, urlopen):
    """Trap 6: never send limit != 100, with or without a cursor."""
    client.list_page(None)
    client.list_page("100")
    for c in urlopen["calls"]:
        assert "limit=100" in c["url"]
        assert c["url"].count("limit=") == 1


def test_put_not_replayed_on_failure(client, urlopen):
    """A PUT that may have landed is not retried (it bumps updated_at)."""
    urlopen["script"] = [ConnectionResetError("reset")] * 3
    with pytest.raises(VendorUnavailable):
        client.update("txn_000001", {"category": "meals"})
    assert len(urlopen["calls"]) == 1


def test_update_only_sends_dict_with_allowed_fields(client, urlopen):
    """Trap 17: bodies are dicts; read-only fields are dropped."""
    urlopen["script"] = [Resp({"id": "txn_000001"})]
    client.update("txn_000001", {"category": "meals", "amount_cents": 1})
    sent = json.loads(urlopen["calls"][0]["data"])
    assert sent == {"category": "meals"}
