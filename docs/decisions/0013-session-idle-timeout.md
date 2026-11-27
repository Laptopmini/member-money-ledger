# 0013. Session idle timeout of 15 minutes

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided at T0 in the build session; the owner picked the recommended option.)
- **Deciders**: Owner (choice), Claude (options)

## Context
ADR 0009 needs a concrete timeout, and polling must not keep a session alive (trap 18).

## Options
- **15 minutes (chosen)**: reasonable balance for financial data
- **30 minutes**: friendlier; longer exposure
- **5 minutes**: safest; annoying

## Decision
15 minutes idle, with a warning 2 minutes before. Only requests carrying `X-User-Activity: 1` extend the session; background polls and refetches do not.

## Consequences
The web client must flag user-initiated requests. Tested by `test_poll_does_not_extend_session`.
