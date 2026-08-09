# forkcast dev command runner. `make help` lists targets.
# Most targets wrap pnpm workspace scripts; the value is a single green `check`
# gate plus recipes that aren't expressible as npm scripts (smoke, kill-port).

# Source dirs the format gate covers — deliberately NOT the repo root, so it
# never churns the many markdown/openspec files that oxfmt would otherwise rewrite.
FMT_DIRS := backend/src frontend/src

.DEFAULT_GOAL := help
.PHONY: help install dev dev-http check test test-backend test-frontend typecheck lint fmt fmt-check smoke kill-port

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install all workspace dependencies
	pnpm install

dev: ## Run backend + frontend in parallel (frontend over HTTPS, self-signed)
	pnpm dev

dev-http: ## Run the app over plain HTTP for browser smoke testing (no SSL warning); see the forkcast-dev skill
	FORKCAST_NO_HTTPS=1 pnpm dev

check: lint typecheck fmt-check test ## Full green gate: lint + typecheck + format + tests (both workspaces)
	@echo "✅ all checks passed"

test: ## Run all tests (both workspaces)
	pnpm -r test

test-backend: ## Run backend tests only
	pnpm --filter @forkcast/backend test

test-frontend: ## Run frontend tests only
	pnpm --filter @forkcast/frontend test

typecheck: ## Typecheck both workspaces
	pnpm -r typecheck

lint: ## Lint (oxlint; design_handoff_* + dist excluded via .oxlintrc.json)
	pnpm lint

fmt: ## Format source dirs in place (oxfmt)
	pnpm exec oxfmt $(FMT_DIRS)

fmt-check: ## Verify source dirs are formatted (oxfmt --check)
	pnpm exec oxfmt --check $(FMT_DIRS)

smoke: ## Boot the backend and run the auth/resolution round-trip (no API key needed)
	@bash scripts/smoke-backend.sh

kill-port: ## Kill whatever is listening on backend port 3000
	@lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "killed :3000" || echo ":3000 already free"
