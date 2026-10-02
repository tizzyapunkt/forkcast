# AGENTS.md

## Project

forkcast is a mobile-first, planning-first meal planning and nutrition tracking PWA (offline, installable, full desktop support). Weekly meal planning against user-defined calorie/macro goals, recipe and ingredient management, grocery lists from the plan. Every interaction must be fast and low-friction — the user's constraint is time. Built for personal use; keep it clean enough to become a product.

## Principles

- **Pragmatic DDD** (frontend and backend): domain names (`MealPlan`, `Recipe`, `NutritionGoal`), bounded contexts (planning, nutrition, shopping), ubiquitous language over CRUD. Aggregates/value objects only where they add clarity.
- **TDD:** failing test first, minimal code, refactor. Test behavior, not implementation or framework/library behavior. Prefer integration-style use-case tests. Not done until tests pass.
- **Build only what's needed:** no speculative infrastructure, patterns or tooling.

## Monorepo

pnpm workspaces: `backend/` (`@forkcast/backend`, Hono API, port 3000) and `frontend/` (`@forkcast/frontend`, Vite React PWA, port 5173).

```bash
pnpm install
pnpm dev                                  # both workspaces in parallel
pnpm --filter @forkcast/<backend|frontend> <command|add pkg>
pnpm add -Dw <pkg>                        # root dev dependency
```

## Backend

Hono + `@hono/node-server`, TypeScript, ESM, Vitest, oxlint + oxfmt, `node --watch` (no bundler). Persistence is JSON files in `backend/data/` — no DB, no Docker until needed.

- **Hexagonal:** domain core has no framework/HTTP/persistence imports; ports are interfaces, adapters implement them.
- **CQRS** for clarity: commands express intent (`PlanMeal`, `AddRecipe`); queries are shaped for the UI and may cross boundaries; no shared read/write models; no event sourcing.
- **API** uses domain language (`/plan-meal`, `/add-to-grocery-list`), not generic REST; shapes reflect business intent.

## Frontend

Vite + React 18 + TS, Tailwind v3, shadcn/ui (Radix + CVA), React Query v5 (all server state), React Hook Form + Zod, Vitest + RTL + MSW, vite-plugin-pwa, vaul, lucide-react, oxlint + oxfmt. UI state is local `useState`/`useReducer` — no global store. Feature folders use domain language (`features/daily-log/`).

**Design system:** `components/ui/` holds domain-free primitives (`Button`, `Input`, `DecimalInput`, `Card`, `Field`, `SegmentedControl`) built with CVA over tokens in `components/ui/tokens.css` — the single place for colours, radii, focus rings.

- Use a primitive before hand-writing control classes; if none fits, add a variant there.
- Pass layout/one-off overrides via `className` (merged by `cn()` in `lib/cn.ts`).
- `components/app/` holds app-aware composites (header, bottom nav, sheets, error banner).
- `<select>`/`<textarea>` get a primitive once a second call site needs one.
- `pnpm --filter @forkcast/frontend build:ui` bundles `components/ui/` into `dist-ui/` for `/design-sync` (needs `/design-login`, local terminal only). New primitives just need exporting from `components/ui/index.ts`.

## Environment & caveats

- Node 22+ (backend uses `--experimental-transform-types`); pnpm 10.33.0 via corepack (`corepack enable && corepack prepare pnpm@10.33.0 --activate`).
- Backend needs `AUTH_PASSWORD` and `AUTH_JWT_SECRET` — copy `backend/.env.example` to `backend/.env`, or it exits on startup.
- Frontend serves HTTPS with a self-signed cert (`@vitejs/plugin-basic-ssl`) and proxies `/api` → `localhost:3000`, **stripping** `/api`. Hit the backend directly without it: `curl http://localhost:3000/nutrition-goal`.
- Runtime data files in `backend/data/` are not committed, except `catalog.json` (food catalog, tracked as the seed for a fresh data dir).
- `node --watch` doesn't pick up new dependencies — restart after `pnpm install`.
- Pre-commit runs `pnpm lint-staged` via husky.
