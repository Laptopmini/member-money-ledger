# 0002. DRF + drf-spectacular with generated TypeScript types

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided in prompt formulation, before T0.)
- **Deciders**: Owner (choice), Claude (options)

## Context
The starter uses Django; the web app needs a reliable contract with the API.

## Options
- **DRF + drf-spectacular**: Collective's stack, committed OpenAPI schema, types generated end to end; some DRF boilerplate
- **django-ninja**: typed and concise; off the team's stack
- **DRF without OpenAPI**: least setup; contract drifts silently between API and web

## Decision
DRF + drf-spectacular. The schema is committed and `openapi-typescript` generates web types (`make types`). CI fails on schema or type drift. Swagger UI in dev only.

## Consequences
A breaking API change shows up as a TypeScript error. Schema generation is part of the gates, and serializers must be explicit and strict.
