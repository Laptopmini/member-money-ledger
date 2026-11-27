# 0009. Session login with idle timeout, CSRF and throttling

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided in prompt formulation, before T0.)
- **Deciders**: Owner (choice), Claude (options)

## Context
The app shows personal financial data; the vendor has no concept of a member (single tenant by construction).

## Options
- **No auth, documented as a limitation**: least work; unacceptable for financial data
- **One seeded member with a session login**: real login, CSRF, timeouts, throttling; single user only

## Decision
Session login for one seeded member: Django sessions, idle timeout (ADR 0013), CSRF on unsafe methods, login throttling (ADR 0014), `HttpOnly`/`SameSite=Lax`/`Secure` (prod) cookies. Every query goes through a member scope so multi-tenant is an extension. The `auth-required` flag is **evaluated server-side** and the UI only mirrors it (trap 25: a client-side flag cannot gate auth). **Background polls do not extend the session**: only requests with `X-User-Activity: 1` refresh it (trap 18). Owner: "it seems important given the context of the app".

## Consequences
Auth tests cover the flag, timeout and polling. Single tenant, no MFA (see `../security.md`).
