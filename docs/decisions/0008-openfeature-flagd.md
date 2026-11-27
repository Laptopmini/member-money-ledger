# 0008. OpenFeature with a flagd container for feature flags

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided in prompt formulation, before T0.)
- **Deciders**: Owner (choice), Claude (options)

## Context
We need flags for unfinished or optional features (`tax-set-aside`, `merchant-rules`, `category-suggestions`, `auth-required`) and a path to a hosted flag service later.

## Options
- **OpenFeature + flagd container**: vendor-neutral API, flags in `flags/flags.json`, runs offline; one more container
- **OpenFeature + in-process file provider**: no extra container; no live change and a weaker production story
- **Env toggles**: trivial; no targeting, no standard API, restart needed

## Decision
OpenFeature with a flagd container. Python: OpenFeature SDK + flagd provider. Web: OpenFeature React SDK + OFREP provider proxied through `/flags`. Code defaults apply when flagd is down. **Moving to LaunchDarkly is an OpenFeature provider swap: application code is unchanged and the flag keys stay.**

## Consequences
Flag evaluation goes through one interface. Security-relevant flags (`auth-required`) are evaluated server-side (ADR 0009, trap 25). Everything runs offline.
