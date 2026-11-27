# Security

Each control's status names the commit that landed it.

## Threat model

**Assets**: member financial data (transactions, categories, tax estimates); the session; the audit log.

**Actors**: other local users on the machine or network; a malicious web page attacking a logged-in member (CSRF); scripts brute-forcing login or hammering the API; compromised or odd vendor data (malformed rows, injected ids).

**Trust boundary**: browser <-> Caddy <-> API <-> vendor / Postgres. Everything from the browser and from the vendor is untrusted input.

## Controls

| Control | Addresses | Source | Status |
|---|---|---|---|
| Session login, `HttpOnly`/`SameSite=Lax`/`Secure` (prod) cookies | other users | ADR 0009 | in place (`0d1c31d`; secure cookies opt-in on plain-HTTP prod profile) |
| CSRF protection on unsafe methods | malicious page | ADR 0009 | in place (`0d1c31d`; plus JSON-only writes `5853fa3`) |
| 15 min idle timeout, 2 min warning; polls do not extend the session (`X-User-Activity`) | abandoned sessions | ADR 0013, trap 18 | in place (`0d1c31d`, `58a76e0`, web `6487f88`) |
| `auth-required` flag evaluated server-side, UI only mirrors it | flag tampering | ADR 0009, trap 25 | in place (`0d1c31d`; fails closed when flagd is down `13b7d4c`) |
| Throttling: reads 300/min, writes 30/min, sync 6/min, login 5/min/IP + 20/h/username | brute force, abuse | ADR 0014 | in place (`5853fa3`; login per-user bucket counts failures only, shared DB cache `58a76e0`) |
| Append-only `AuditEvent` (actor, action, txn id, before/after, request id, ip, time) | repudiation | baseline | in place (`77429e1`; app-level only, not DB-enforced) |
| Strict ASCII id regex before building vendor URLs | path injection | trap 9 | in place (`2ec4934`) |
| Own validation on every create/update path; vendor POST validates nothing | bad data | trap 10 | in place (`2ec4934`, `038cd9b`) |
| Quarantine malformed synced rows | odd vendor data | ADR 0020, trap 16 | in place (`2ec4934`, `038cd9b`) |
| Mapped error envelope; no raw vendor errors leaked | info disclosure | trap 8 | in place (`47681ee`) |
| Secrets, `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` from env; `.env.example` | starter defaults | trap 27 | in place (`77429e1`, `3a8174d`) |
| Security headers + CSP via Caddy (prod profile) | XSS, clickjacking | baseline | in place (`3a8174d`) |
| Vendor calls with timeouts and bounded retry; tolerate non-JSON | vendor failures | trap 17 | in place (`2ec4934`) |
| No merchant or description text in logs; request-id middleware | PII in logs | baseline | in place (`77429e1`; query strings redacted `5853fa3`) |
| `pip-audit` and `npm audit --omit=dev` in pre-push | vulnerable deps | ADR 0007 | in place (`729e4c6`, CI `4cece1b`) |
| Member scope on every query | future multi-tenancy | ADR 0009 | partial: scope exists, transactions have no member FK yet |

## Known gaps

- The vendor has no authentication and is exposed on :8080 in dev.
- Single tenant: the vendor has no concept of a member.
- Last write wins at the vendor (mitigated by `expected_updated_at` in our API).
- No MFA.
- No encryption at rest beyond Postgres defaults.
- Dev compose runs with DEBUG on.
- The audit log is append-only at the application layer only, not enforced by the database.
- Per-IP limits behind a proxy depend on trusted forwarded headers.


## Gaps found during the build

- Throttle counters are shared through the database cache; fine for one host, use Redis for many (trap 40).
- With `auth-required` off, writes rely on JSON-only Content-Type + `SameSite=Lax` instead of CSRF tokens.
- Same-second concurrent edits are undetectable (vendor `updated_at` resolution, trap 32).
- Set-aside marks are append-only in the app (reversal marks with a reason), not enforced by the database.
