# 0022. AI category suggestions: provider-agnostic, suggestion-only, rules first

- **Status**: Accepted (Could tier; behind `category-suggestions`, default off)
- **Date**: 2026-11-27
- **Deciders**: Owner (in prompt formulation: provider-agnostic, local demo on LM Studio), Claude (design)

## Context
Uncategorized transactions block the summary and the set-aside estimate. Merchant rules
(ADR 0018) handle merchants the member has already categorized once. The rest are unseen
merchants. An LLM can propose a category for those, but cost, latency, privacy and correctness
all matter more than novelty.

## Options
- **No AI**: rules only. Zero cost and risk; unseen merchants stay manual.
- **Vendor-specific SDK** (one provider): easy, but locks us in and can't run offline for the
  demo.
- **Any OpenAI-compatible `/v1/chat/completions` endpoint (chosen)**: works with LM Studio,
  vLLM, Ollama's OpenAI mode, or a cloud provider, selected by `LLM_BASE_URL` / `LLM_MODEL` /
  `LLM_API_KEY`.

## Decision
- Rules first (deterministic). The model is called only for an **unseen merchant** on an
  **uncategorized** row, and the result is cached per normalized merchant.
- The response is constrained to our 16 category keys with a JSON-schema `response_format`,
  temperature 0, and validated again on our side.
- It's a **suggestion only**: a chip the member accepts. Never auto-applied.
- **Data minimization**: only the merchant, description and direction are sent, never amounts
  or account ids. Nothing is logged.
- When the variables are unset or the flag is off, the feature is invisible (404
  `feature_disabled`). A timeout or error returns "no suggestion", never an error page.
- Local demo: LM Studio with `google/gemma-4-26b-a4b`, a mixture-of-experts model with about
  4B active parameters, so it's fast. `manage.py eval_suggestions` reports accuracy and
  p50/p95 latency on a seed eval set. Member corrections (a suggestion rejected, then a
  different category picked) are the future eval set.

## Consequences
- A cloud endpoint sends merchant names to a third party. That needs a DPA and a member-facing
  disclosure before it's turned on in production.
- Per-merchant caching makes cost roughly O(unique merchants), not O(transactions).

## Status of the eval (2026-11-27, end of the build)
The feature is built and unit-tested (mocked endpoint): enum-constrained output, cache, rules
take precedence, data minimization, and graceful failure. The live eval against LM Studio
(`google/gemma-4-26b-a4b`) **has not produced a quality result yet**. During the build, every
call timed out (8 s) or returned an HTTP error, and a direct `curl` to
`/v1/chat/completions` timed out after 30 s, so the model wasn't serving. The 0/15 recorded
measures availability, not accuracy. The owner chose to defer the rerun. Next step: load the
model in LM Studio, then run
`docker compose exec -e LLM_BASE_URL=http://host.docker.internal:1234/v1 -e LLM_MODEL=google/gemma-4-26b-a4b api python manage.py eval_suggestions --no-cache`.
Also check whether LM Studio's build supports `response_format: json_schema` (the client falls
back to extracting JSON from text). Some of the HTTP errors may have been a 400 on that field.
