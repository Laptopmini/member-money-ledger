"""Ledgerly client (stdlib only). Never surfaces vendor message text to callers."""

import json
import logging
import re
import time
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings

log = logging.getLogger(__name__)

TXN_ID_RE = re.compile(r"\A[A-Za-z0-9_-]{1,64}\Z", re.ASCII)
UPDATABLE = {"category", "description"}
PAGE_LIMIT = 100


class InvalidTransactionId(ValueError):
    pass


class VendorError(Exception):
    """Base. Messages are fixed strings: never include vendor text."""


class VendorUnavailable(VendorError):
    pass


class VendorNotFound(VendorError):
    pass


class VendorRejected(VendorError):
    pass


def validate_txn_id(txn_id: object) -> str:
    if not isinstance(txn_id, str) or not TXN_ID_RE.match(txn_id):
        raise InvalidTransactionId("invalid transaction id")
    return txn_id


class LedgerlyClient:
    def __init__(
        self,
        base_url: str | None = None,
        timeout: float | None = None,
        retries: int | None = None,
    ) -> None:
        self.base_url = (base_url or settings.VENDOR_URL).rstrip("/")
        self.timeout = settings.VENDOR_TIMEOUT if timeout is None else timeout
        self.retries = settings.VENDOR_RETRIES if retries is None else retries

    def _once(self, method: str, path: str, body: dict[str, Any] | None) -> Any:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(  # noqa: S310 - base_url is operator config, http(s)
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:  # noqa: S310
                raw = resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise VendorNotFound("not found") from None
            if 400 <= exc.code < 500:
                raise VendorRejected(f"vendor rejected request ({exc.code})") from None
            raise VendorUnavailable(f"vendor error ({exc.code})") from None
        except (urllib.error.URLError, OSError, ValueError, TimeoutError) as exc:
            raise VendorUnavailable(f"vendor unreachable ({type(exc).__name__})") from None
        except Exception as exc:  # http.client.HTTPException (e.g. dropped connection)
            raise VendorUnavailable(f"vendor failure ({type(exc).__name__})") from None
        if not raw:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            raise VendorUnavailable("vendor returned non-JSON") from None

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        # Only idempotent GETs are retried; a PUT that may have landed is never replayed.
        attempts = 1 + (self.retries if method == "GET" else 0)
        last: VendorUnavailable | None = None
        for attempt in range(attempts):
            try:
                return self._once(method, path, body)
            except VendorUnavailable as exc:
                last = exc
                if attempt + 1 < attempts:
                    time.sleep(0.2 * (2**attempt))
        raise last or VendorUnavailable("vendor unreachable")

    def list_page(self, cursor: str | None) -> tuple[list[dict[str, Any]], str | None]:
        path = f"/v1/transactions?limit={PAGE_LIMIT}"
        if cursor:
            from urllib.parse import quote

            path += f"&cursor={quote(cursor, safe='')}"
        payload = self._request("GET", path)
        if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
            raise VendorUnavailable("unexpected list shape")
        nxt = payload.get("next_cursor")
        if nxt is not None and not isinstance(nxt, str):
            raise VendorUnavailable("unexpected cursor")
        return [r for r in payload["data"]], nxt

    def get(self, txn_id: str) -> dict[str, Any]:
        row = self._request("GET", f"/v1/transactions/{validate_txn_id(txn_id)}")
        if not isinstance(row, dict):
            raise VendorUnavailable("unexpected row shape")
        return row

    def update(self, txn_id: str, fields: dict[str, Any]) -> dict[str, Any]:
        body = {k: v for k, v in fields.items() if k in UPDATABLE}
        row = self._request("PUT", f"/v1/transactions/{validate_txn_id(txn_id)}", body)
        if not isinstance(row, dict):
            raise VendorUnavailable("unexpected row shape")
        return row

    def create(self, fields: dict[str, Any]) -> dict[str, Any]:
        row = self._request("POST", "/v1/transactions", dict(fields))
        if not isinstance(row, dict):
            raise VendorUnavailable("unexpected row shape")
        return row

    def health(self) -> bool:
        try:
            payload = self._once("GET", "/health", None)
        except VendorError:
            return False
        return isinstance(payload, dict) and payload.get("status") == "ok"
