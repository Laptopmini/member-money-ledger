"""Starter views. Replace these with your own design.

`transactions` only proxies the first vendor page so you can see the wiring
work end to end. It is not a solution.
"""

import json
import urllib.request

from django.conf import settings
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response


def _vendor_get(path: str) -> dict:
    with urllib.request.urlopen(f"{settings.VENDOR_URL}{path}", timeout=5) as resp:
        return json.loads(resp.read())


@api_view(["GET"])
def ping(request):
    with connection.cursor() as cur:
        cur.execute("SELECT 1")
    return Response({"db": "ok", "vendor": _vendor_get("/health")["status"]})


@api_view(["GET"])
def transactions(request):
    page = _vendor_get("/v1/transactions?limit=50")
    return Response({"results": page["data"]})
