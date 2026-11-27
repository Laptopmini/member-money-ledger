# 0010. Full test pyramid

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided in prompt formulation, before T0.)
- **Deciders**: Owner (choice), Claude (options)

## Context
Money math and sync are where bugs cost trust; UI needs accessibility and performance checks.

## Options
- **Full pyramid with E2E on the prod build**: highest confidence; more setup and CI time
- **Lighthouse manual only**: cheap; regressions go unnoticed
- **Backend-heavy**: fast; UI and integration gaps

## Decision
Full pyramid: pytest-django (money, sync with a fake vendor, vendor client), Vitest + Testing Library (formatting, dates, components), Playwright + `@axe-core/playwright` against the prod build (vendor reset between runs), Lighthouse CI >= 0.95 on performance, accessibility, best practices and SEO.

## Consequences
Each trap in `../traps.md` names its test. E2E needs a vendor reset step; Lighthouse and Playwright run in CI (ADR 0007).
