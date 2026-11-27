# Security

Status of every control is **planned** until the main session flips it to **in place** with the commit that landed it.

## Threat model

**Assets**: member financial data (transactions, categories, tax estimates); the session; the audit log.

**Actors**: other local users on the machine or network; a malicious web page attacking a logged-in member (CSRF); scripts brute-forcing login or hammering the API; compromised or odd vendor data (malformed rows, injected ids).

**Trust boundary**: browser <-> Caddy <-> API <-> vendor / Postgres. Everything from the browser and from the vendor is untrusted input.

## Controls

| Control | Addresses | Source | Status |
|---|---|---|---|
| Session login, `HttpOnly`/`SameSite=Lax`/`Secure` (prod) cookies | other users | ADR 0009 | planned |
| CSRF protection on unsafe methods | malicious page | ADR 0009 | planned |
| 15 min idle timeout, 2 min warning; polls do not extend the session (`X-User-Activity`) | abandoned sessions | ADR 0013, trap 18 | planned |
| `auth-required` flag evaluated server-side, UI only mirrors it | flag tampering | ADR 0009, trap 25 | planned |
| Throttling: reads 300/min, writes 30/min, sync 6/min, login 5/min/IP + 20/h/username | brute force, abuse | ADR 0014 | planned |
| Append-only `AuditEvent` (actor, action, txn id, before/after, request id, ip, time) | repudiation | baseline | planned |
| Strict ASCII id regex before building vendor URLs | path injection | trap 9 | planned |
| Own validation on every create/update path; vendor POST validates nothing | bad data | trap 10 | planned |
| Quarantine malformed synced rows | odd vendor data | ADR 0020, trap 16 | planned |
| Mapped error envelope; no raw vendor errors leaked | info disclosure | trap 8 | planned |
| Secrets, `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` from env; `.env.example` | starter defaults | trap 27 | planned |
| Security headers + CSP via Caddy (prod profile) | XSS, clickjacking | baseline | planned |
| Vendor calls with timeouts and bounded retry; tolerate non-JSON | vendor failures | trap 17 | planned |
| No merchant or description text in logs; request-id middleware | PII in logs | baseline | planned |
| `pip-audit` and `npm audit --omit=dev` in pre-push | vulnerable deps | ADR 0007 | planned |
| Member scope on every query | future multi-tenancy | ADR 0009 | planned |

## Known gaps

- The vendor has no authentication and is exposed on :8080 in dev.
- Single tenant: the vendor has no concept of a member.
- Last write wins at the vendor (mitigated by `expected_updated_at` in our API).
- No MFA.
- No encryption at rest beyond Postgres defaults.
- Dev compose runs with DEBUG on.
- The audit log is append-only at the application layer only, not enforced by the database.
- Per-IP limits behind a proxy depend on trusted forwarded headers.
