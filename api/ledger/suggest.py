"""AI category suggestions via any OpenAI-compatible /chat/completions endpoint.

Data minimization: only merchant, description and direction are sent. Never amounts, account
ids or dates. Nothing here logs merchant or description text. The model's answer is validated
against our category list; anything else is discarded.
"""

import json
import logging
import time
import urllib.request
from typing import Any

from django.conf import settings

from .categories import CATEGORIES, label_for
from .flags import flag
from .models import MerchantRule, MerchantSuggestion, Transaction
from .rules import normalize_merchant

log = logging.getLogger(__name__)

MEANINGS = {
    "income": "money earned from clients (credits such as invoices and payments received)",
    "transfer": "movement between the member's own accounts (card payments, savings moves)",
    "personal": "personal, non-business spending (groceries, entertainment, family)",
    "software": "software, apps and subscriptions used for work",
    "meals": "business meals and coffee with clients or while working",
    "travel": "flights, hotels, ground transport, trips",
    "office": "office supplies and small consumables",
    "advertising": "ads and marketing spend",
    "contractors": "payments to freelancers and contract workers",
    "professional_services": "legal, accounting and other professional fees",
    "insurance": "business and liability insurance",
    "utilities": "phone and internet",
    "rent": "rent, coworking and workspace",
    "equipment": "computers, monitors, devices and other durable equipment",
    "fees": "bank and payment-processing fees",
    "other": "other business expenses that fit nowhere else",
}

SYSTEM_PROMPT = (
    "You categorize one bank transaction for a self-employed person. Pick exactly one category "
    'key from this list and answer with JSON {"category": "<key>"}.\n'
    + "\n".join(f"- {key}: {CATEGORIES[key].label}, {MEANINGS[key]}" for key in CATEGORIES)
)

RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "category",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {"category": {"type": "string", "enum": list(CATEGORIES)}},
            "required": ["category"],
            "additionalProperties": False,
        },
    },
}


def configured() -> bool:
    return bool(settings.LLM_BASE_URL and settings.LLM_MODEL)


def enabled() -> bool:
    """Off (and invisible) unless the flag is on AND an endpoint and model are configured."""
    return flag("category-suggestions") and configured()


def _parse(content: str) -> str | None:
    try:
        data = json.loads(content)
    except ValueError:
        start, end = content.find("{"), content.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            data = json.loads(content[start : end + 1])
        except ValueError:
            return None
    key = data.get("category") if isinstance(data, dict) else None
    return key if isinstance(key, str) and key in CATEGORIES else None


def suggest_category(merchant: str, description: str, direction: str) -> tuple[str | None, int]:
    """Returns (category or None, latency in ms). Never raises."""
    payload = {
        "model": settings.LLM_MODEL,
        "temperature": 0,
        "response_format": RESPONSE_FORMAT,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {"merchant": merchant, "description": description, "direction": direction}
                ),
            },
        ],
    }
    headers = {"Content-Type": "application/json"}
    if settings.LLM_API_KEY:
        headers["Authorization"] = f"Bearer {settings.LLM_API_KEY}"
    req = urllib.request.Request(  # noqa: S310 - operator-configured http(s) endpoint
        f"{settings.LLM_BASE_URL}/chat/completions",
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    started = time.monotonic()
    category: str | None = None
    try:
        with urllib.request.urlopen(req, timeout=settings.LLM_TIMEOUT) as resp:  # noqa: S310
            body = json.loads(resp.read())
        category = _parse(str(body["choices"][0]["message"]["content"]))
    except Exception as exc:  # noqa: BLE001 - a suggestion must never break a request
        log.warning("suggest_failed type=%s", type(exc).__name__)
    return category, int((time.monotonic() - started) * 1000)


def resolve(txn: Transaction, member: Any, use_cache: bool = True) -> dict[str, Any]:
    """Rule first (deterministic), then cache, then the model. Uncategorized rows only."""
    empty: dict[str, Any] = {"category": None}
    if txn.category is not None:
        return empty
    key = normalize_merchant(txn.merchant)
    rule = MerchantRule.objects.filter(member=member, merchant_key=key).first() if member else None
    if rule is not None:
        return _answer(rule.category, "rule", None)
    if use_cache:
        cached = MerchantSuggestion.objects.filter(merchant_key=key).first()
        if cached is not None:
            return _answer(cached.category, "cache", cached.model)
    category, _latency = suggest_category(txn.merchant, txn.description, txn.direction)
    if category is None:
        return empty
    MerchantSuggestion.objects.update_or_create(
        merchant_key=key, defaults={"category": category, "model": settings.LLM_MODEL}
    )
    return _answer(category, "model", settings.LLM_MODEL)


def _answer(category: str, source: str, model: str | None) -> dict[str, Any]:
    return {"category": category, "label": label_for(category), "source": source, "model": model}
