import io
import json
from typing import Any

import pytest
from rest_framework.test import APIClient

from ledger import flags, suggest
from ledger.members import ensure_member
from ledger.models import MerchantRule, MerchantSuggestion


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def llm_reply(category):
    body = {"choices": [{"message": {"content": json.dumps({"category": category})}}]}
    return FakeResp(json.dumps(body).encode())


@pytest.fixture
def llm(monkeypatch, settings):
    settings.LLM_BASE_URL = "http://llm.test/v1"
    settings.LLM_MODEL = "test-model"
    settings.LLM_API_KEY = ""
    flags.TEST_OVERRIDES = {"auth-required": False, "category-suggestions": True}
    state: dict = {"calls": [], "reply": "software"}

    def fake_urlopen(req, timeout=None):
        state["calls"].append(
            {"url": req.full_url, "body": json.loads(req.data), "timeout": timeout}
        )
        if isinstance(state["reply"], Exception):
            raise state["reply"]
        return llm_reply(state["reply"])

    monkeypatch.setattr(suggest.urllib.request, "urlopen", fake_urlopen)
    return state


def test_valid_category(llm):
    assert suggest.suggest_category("Figma", "seat", "debit")[0] == "software"
    call = llm["calls"][0]
    assert call["url"] == "http://llm.test/v1/chat/completions"
    assert call["body"]["temperature"] == 0
    schema = call["body"]["response_format"]["json_schema"]
    assert (
        schema["strict"] is True and len(schema["schema"]["properties"]["category"]["enum"]) == 16
    )


def test_off_list_and_garbage_are_none(llm):
    llm["reply"] = "groceries"
    assert suggest.suggest_category("X", "", "debit")[0] is None


def test_timeout_is_none(llm):
    llm["reply"] = TimeoutError("slow")
    category, latency = suggest.suggest_category("X", "", "debit")
    assert category is None and latency >= 0


def test_request_has_no_amounts_or_accounts(llm, make_txn):
    suggest.suggest_category("Figma", "seat", "debit")
    user_content = llm["calls"][0]["body"]["messages"][1]["content"]
    assert "amount" not in user_content and "account" not in user_content
    user = json.loads(user_content)
    assert set(user) == {"merchant", "description", "direction"}


def test_endpoint_caches_per_merchant(llm, make_txn):
    a = make_txn(id="t1", merchant="Figma", category=None)
    b = make_txn(id="t2", merchant=" FIGMA ", category=None)
    api = APIClient()
    first = api.get(f"/api/transactions/{a.id}/suggestion").json()
    assert first == {
        "category": "software",
        "label": "Software & subscriptions",
        "source": "model",
        "model": "test-model",
    }
    second = api.get(f"/api/transactions/{b.id}/suggestion").json()
    assert second["source"] == "cache" and len(llm["calls"]) == 1
    assert MerchantSuggestion.objects.count() == 1


def test_rule_beats_model(llm, make_txn):
    member: Any = ensure_member()
    MerchantRule.objects.create(
        member=member, merchant_key="figma", merchant="Figma", category="travel"
    )
    t = make_txn(id="t1", merchant="Figma", category=None)
    out = APIClient().get(f"/api/transactions/{t.id}/suggestion").json()
    assert out["category"] == "travel" and out["source"] == "rule" and llm["calls"] == []


def test_categorized_row_and_failures_return_null(llm, make_txn):
    done = make_txn(id="t1", merchant="Figma", category="meals")
    assert APIClient().get(f"/api/transactions/{done.id}/suggestion").json() == {"category": None}
    t = make_txn(id="t2", merchant="Other", category=None)
    llm["reply"] = TimeoutError("slow")
    r = APIClient().get(f"/api/transactions/{t.id}/suggestion")
    assert r.status_code == 200 and r.json() == {"category": None}


def test_off_when_flag_or_config_missing(llm, make_txn, settings):
    t = make_txn(id="t1", merchant="Figma", category=None)
    flags.TEST_OVERRIDES = {"auth-required": False, "category-suggestions": False}
    r = APIClient().get(f"/api/transactions/{t.id}/suggestion")
    assert r.status_code == 404 and r.json()["error"]["code"] == "feature_disabled"
    flags.TEST_OVERRIDES = {"auth-required": False, "category-suggestions": True}
    settings.LLM_BASE_URL = ""
    assert APIClient().get(f"/api/transactions/{t.id}/suggestion").status_code == 404
    assert llm["calls"] == []
