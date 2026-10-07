# forkcast dev command runner. `make help` lists targets.
# Most targets wrap pnpm workspace scripts; the value is a single green `check`
# gate plus recipes that aren't expressible as npm scripts (smoke, kill-port).

# Source dirs the format gate covers — deliberately NOT the repo root, so it
# never churns the many markdown/openspec files that `vp fmt` would otherwise rewrite.
FMT_DIRS := backend/src frontend/src website/src website/vite.config.ts

.DEFAULT_GOAL := help
.PHONY: help install dev dev-http check test test-backend test-frontend typecheck lint fmt fmt-check smoke kill-port website-dev website-build website-preview

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install all workspace dependencies
	pnpm install

dev: ## Run backend + frontend in parallel (frontend over HTTPS, self-signed)
	pnpm dev

dev-http: ## Run the app over plain HTTP for browser smoke testing (no SSL warning); see the forkcast-dev skill
	FORKCAST_NO_HTTPS=1 pnpm dev

check: lint typecheck fmt-check test website-build ## Full green gate: lint + typecheck + format + tests + website build
	@echo "✅ all checks passed"

test: ## Run all tests (both workspaces)
	pnpm -r test

test-backend: ## Run backend tests only
	pnpm --filter @forkcast/backend test

test-frontend: ## Run frontend tests only
	pnpm --filter @forkcast/frontend test

typecheck: ## Typecheck both workspaces
	pnpm -r typecheck

lint: ## Lint (vp lint / Oxlint; config + ignores in the root vite.config.ts)
	pnpm lint

fmt: ## Format source dirs in place (vp fmt / Oxfmt)
	pnpm exec vp fmt $(FMT_DIRS)

fmt-check: ## Verify source dirs are formatted (vp fmt --check)
	pnpm exec vp fmt --check $(FMT_DIRS)

website-dev: ## Run the landing page dev server (port 5174)
	pnpm dev:website

website-build: ## Build the landing page into website/dist (production settings from website/.env.production)
	pnpm --filter @forkcast/website build

website-preview: website-build ## Serve the built landing page locally (port 4173); Umami does not count it
	pnpm --filter @forkcast/website preview

smoke: ## Boot the backend and run the auth/resolution round-trip (no API key needed)
	@bash scripts/smoke-backend.sh

kill-port: ## Kill whatever is listening on backend port 3000
	@lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "killed :3000" || echo ":3000 already free"
