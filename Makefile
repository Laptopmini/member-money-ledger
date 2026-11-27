# Run `make` (or `make help`) to list targets. Commands run inside containers, so the host needs only Docker.
.DEFAULT_GOAL := help
.PHONY: help up down prod logs test test-api test-web e2e lint fmt typecheck schema types reset-demo verify audit

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Start the dev stack (build images first)
	docker compose up --build

down: ## Stop the stack
	docker compose down

prod: ## Start the prod-like stack (gunicorn + built web behind Caddy on :8081)
	docker compose --profile prod up --build

logs: ## Follow logs for all services
	docker compose logs -f

test: test-api test-web ## Run API and web unit tests

test-api: ## Run pytest in the api container
	docker compose exec -T api pytest -q

test-web: ## Run Vitest in the web container
	docker compose exec -T web npx vitest run

e2e: ## Run Playwright end-to-end tests (needs the stack up)
	cd web && npx playwright test

lint: ## Lint Python (ruff) and TypeScript (biome) without changing files
	docker compose exec -T api ruff check .
	docker compose exec -T api ruff format --check .
	docker compose exec -T web npx biome check .

fmt: ## Format and auto-fix Python and TypeScript
	docker compose exec -T api ruff format .
	docker compose exec -T api ruff check --fix .
	docker compose exec -T web npx biome check --write .

typecheck: ## Type-check Python (mypy) and TypeScript (tsc)
	docker compose exec -T api mypy .
	docker compose exec -T web npx tsc --noEmit

schema: ## Export the OpenAPI schema to api/schema.yml and validate it
	docker compose exec -T api python manage.py spectacular --file schema.yml --validate

types: schema ## Regenerate web/src/api/schema.d.ts from the OpenAPI schema
	docker compose exec -T web npm run types

reset-demo: ## Reset the vendor and mirror. SEED=1 also loads ~60 demo rows
	docker compose restart vendor
	docker compose exec -T api python manage.py reset_mirror --sync $(if $(SEED),--seed,)

verify: lint typecheck test ## Full gate: lint, typecheck, tests, and schema/type drift check
	git diff --exit-code api/schema.yml web/src/api/schema.d.ts

audit: ## Audit Python and production npm dependencies
	docker compose exec -T api pip-audit -r requirements.txt
	docker compose exec -T web npm audit --omit=dev
