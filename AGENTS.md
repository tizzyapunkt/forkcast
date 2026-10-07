# AGENTS.md

## Project

forkcast is a mobile-first, planning-first meal planning and nutrition tracking PWA (offline, installable, full desktop support). Weekly meal planning against user-defined calorie/macro goals, recipe and ingredient management, grocery lists from the plan. Every interaction must be fast and low-friction — the user's constraint is time. Built for personal use; keep it clean enough to become a product.

## Principles

- **Pragmatic DDD** (frontend and backend): domain names (`MealPlan`, `Recipe`, `NutritionGoal`), bounded contexts (planning, nutrition, shopping), ubiquitous language over CRUD. Aggregates/value objects only where they add clarity.
- **TDD:** failing test first, minimal code, refactor. Test behavior, not implementation or framework/library behavior. Prefer integration-style use-case tests. Not done until tests pass.
- **Build only what's needed:** no speculative infrastructure, patterns or tooling.

## Monorepo

pnpm workspaces: `backend/` (`@forkcast/backend`, Hono API, port 3000), `frontend/` (`@forkcast/frontend`, Vite React PWA, port 5173) and `website/` (`@forkcast/website`, public landing page, port 5174).

```bash
pnpm install
pnpm dev                                  # backend + frontend in parallel
pnpm dev:website                          # landing page
pnpm --filter @forkcast/<backend|frontend> <command|add pkg>
pnpm add -Dw <pkg>                        # root dev dependency
```

## Backend

Hono + `@hono/node-server`, TypeScript, ESM, Vite+ (`vp test` / `vp lint` / `vp fmt`), `node --watch` (no bundler). Persistence is JSON files in `backend/data/` — no DB, no Docker until needed.

- **Hexagonal:** domain core has no framework/HTTP/persistence imports; ports are interfaces, adapters implement them.
- **CQRS** for clarity: commands express intent (`PlanMeal`, `AddRecipe`); queries are shaped for the UI and may cross boundaries; no shared read/write models; no event sourcing.
- **API** uses domain language (`/plan-meal`, `/add-to-grocery-list`), not generic REST; shapes reflect business intent.

## Frontend

Vite + React 19 + TS, Tailwind v4 (CSS-first, theme in `components/ui/tokens.css`), shadcn/ui (Radix + CVA), React Query v5 (all server state), React Hook Form + Zod, Vite+ (`vp`: dev/build/test/lint/fmt), RTL + MSW, vite-plugin-pwa, vaul, lucide-react. UI state is local `useState`/`useReducer` — no global store. Feature folders use domain language (`features/daily-log/`).

**Design system:** `components/ui/` holds domain-free primitives (`Button`, `Input`, `DecimalInput`, `Card`, `Field`, `SegmentedControl`) built with CVA over tokens in `components/ui/tokens.css` — the single place for colours, radii, focus rings.

- Use a primitive before hand-writing control classes; if none fits, add a variant there.
- Pass layout/one-off overrides via `className` (merged by `cn()` in `lib/cn.ts`).
- `components/app/` holds app-aware composites (header, bottom nav, sheets, error banner).
- `<select>`/`<textarea>` get a primitive once a second call site needs one.
- `pnpm --filter @forkcast/frontend build:ui` bundles `components/ui/` into `dist-ui/` for `/design-sync` (needs `/design-login`, local terminal only). New primitives just need exporting from `components/ui/index.ts`.

## Website

Public landing page (EN at `/`, DE at `/de/`) with an interest check for hosted vs. self-hosted use. Plain HTML + a little vanilla JS, built by Vite+ as a multi-page app — no framework, no React, independent of the app's design system. Umami is injected at build time only when `UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID` are set (`website/.env.example`).

## Environment & caveats

- Node 24 LTS (backend uses `--experimental-transform-types`); pnpm 12 via corepack (`corepack enable`; the version comes from `packageManager`). pnpm enforces a 1-day `minimumReleaseAge` — a package published in the last 24h won't resolve until it ages (or is listed in `minimumReleaseAgeExclude`).
- Backend needs `AUTH_PASSWORD` and `AUTH_JWT_SECRET` — copy `backend/.env.example` to `backend/.env`, or it exits on startup.
- Frontend serves HTTPS with a self-signed cert (`@vitejs/plugin-basic-ssl`) and proxies `/api` → `localhost:3000`, **stripping** `/api`. Hit the backend directly without it: `curl http://localhost:3000/nutrition-goal`.
- Runtime data files in `backend/data/` are not committed, except `catalog.json` (food catalog, tracked as the seed for a fresh data dir).
- `node --watch` doesn't pick up new dependencies — restart after `pnpm install`.
- Tooling is Vite+ (`vite-plus`): lint/fmt/staged config lives in the root `vite.config.ts`; tests import from `vite-plus/test` (lint enforces it).
- Pre-commit runs `vp staged` (`.vite-hooks/pre-commit`); `pnpm install` installs the hook via `vp config`.
