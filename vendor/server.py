"""Ledgerly: the bank-data vendor our app integrates with.

Do not change this service. It stands in for a third-party API.
See CONTRACT.md for the full contract.
"""

import json
import os
import re
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("PORT", "8080"))
MAX_LIMIT = 100
DEFAULT_LIMIT = 50

MUTABLE_FIELDS = {"category", "description"}
REQUIRED_ON_CREATE = {"account_id", "posted_on", "amount_cents", "direction", "merchant"}

_lock = threading.Lock()
_rows: dict[str, dict] = {}
_next_id = 1


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _load_seed() -> None:
    global _next_id
    seed = json.loads((Path(__file__).parent / "seed.json").read_text())
    for row in seed:
        _rows[row["id"]] = row
    _next_id = len(seed) + 1


def _sorted_ids() -> list[str]:
    return sorted(_rows, key=lambda i: (_rows[i]["posted_on"], i), reverse=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "Ledgerly/1.0"

    def log_message(self, fmt, *args):
        print(f"[vendor] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")

    def _send(self, status: int, body=None, headers: dict | None = None) -> None:
        payload = b"" if body is None else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        for k, v in (headers or {}).items():
            self.send_header(k, str(v))
        self.end_headers()
        self.wfile.write(payload)

    def _error(self, status: int, code: str, message: str, headers: dict | None = None) -> None:
        self._send(status, {"error": {"code": code, "message": message}}, headers)

    def _body(self) -> dict | None:
        length = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return None

    def _route(self, method: str) -> None:
        url = urlparse(self.path)
        if url.path == "/health":
            return self._send(200, {"status": "ok"})

        if url.path == "/v1/transactions":
            if method == "GET":
                return self._list(parse_qs(url.query))
            if method == "POST":
                return self._create()
        m = re.fullmatch(r"/v1/transactions/([\w-]+)", url.path)
        if m:
            txn_id = m.group(1)
            if method == "GET":
                return self._get(txn_id)
            if method == "PUT":
                return self._update(txn_id)
            if method == "DELETE":
                return self._delete(txn_id)
        return self._error(404, "not_found", "No such route.")

    def _list(self, q: dict) -> None:
        try:
            limit = min(int(q.get("limit", [DEFAULT_LIMIT])[0]), MAX_LIMIT)
            offset = int(q.get("cursor", ["0"])[0] or 0)
        except ValueError:
            return self._error(400, "bad_request", "limit and cursor must be valid.")
        ids = _sorted_ids()
        page = [_rows[i] for i in ids[offset : offset + limit]]
        nxt = str(offset + limit) if offset + limit < len(ids) else None
        self._send(200, {"data": page, "next_cursor": nxt})

    def _get(self, txn_id: str) -> None:
        row = _rows.get(txn_id)
        if not row:
            return self._error(404, "not_found", f"Transaction {txn_id} not found.")
        self._send(200, row)

    def _create(self) -> None:
        global _next_id
        body = self._body()
        if body is None or not REQUIRED_ON_CREATE <= body.keys():
            return self._error(422, "invalid", f"Required: {sorted(REQUIRED_ON_CREATE)}.")
        with _lock:
            txn_id = f"txn_{_next_id:06d}"
            _next_id += 1
            row = {
                "id": txn_id,
                "account_id": body["account_id"],
                "posted_on": body["posted_on"],
                "amount_cents": body["amount_cents"],
                "direction": body["direction"],
                "currency": "USD",
                "merchant": body["merchant"],
                "category": body.get("category"),
                "description": body.get("description", ""),
                "status": "posted",
                "updated_at": _now(),
            }
            _rows[txn_id] = row
        self._send(201, row)

    def _update(self, txn_id: str) -> None:
        body = self._body()
        if body is None:
            return self._error(400, "bad_request", "Body must be JSON.")
        if not body.keys() <= MUTABLE_FIELDS:
            return self._error(422, "invalid", f"Only {sorted(MUTABLE_FIELDS)} can change.")
        with _lock:
            row = _rows.get(txn_id)
            if not row:
                return self._error(404, "not_found", f"Transaction {txn_id} not found.")
            row.update(body)
            row["updated_at"] = _now()
        self._send(200, row)

    def _delete(self, txn_id: str) -> None:
        with _lock:
            if _rows.pop(txn_id, None) is None:
                return self._error(404, "not_found", f"Transaction {txn_id} not found.")
        self._send(204, None)

    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def do_PUT(self):
        self._route("PUT")

    def do_DELETE(self):
        self._route("DELETE")


if __name__ == "__main__":
    _load_seed()
    print(f"[vendor] Ledgerly v1 listening on :{PORT} with {len(_rows)} transactions")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
