# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General

### Project

forkcast is a personal meal planning and nutrition tracking PWA. The core problem it solves: existing apps (fddb, yazio, myfitnesspal) make planning meals a week in advance clunky. forkcast is planning-first while still being flexible in adhoc tracking.

**Key capabilities:**

- Weekly meal planning with calorie and macro tracking against user-defined goals (no fixed diet approach)
- Recipe and ingredient management
- Grocery list generation from the weekly plan
- Mobile-first PWA (works offline, installable), full desktop support

**Design principle:** every interaction must be fast and low-friction. The target user has a full-time job, a young family, and serious fitness goals — time is the constraint.

Built for personal use initially; keep architecture clean enough to become a product later.

### Domain-Driven Design (pragmatic)

Apply DDD for structure and language, not ceremony — in both frontend and backend:

- Model the domain explicitly: `MealPlan`, `Recipe`, `Ingredient`, `NutritionGoal`, etc. — names should reflect the domain, not database tables
- Use bounded contexts to separate concerns (e.g. planning, nutrition, shopping)
- Use aggregates and value objects where they add clarity, skip them where they add boilerplate — proper modularization matters more than strict DDD pattern compliance
- Ubiquitous language: code should read like the domain, not like CRUD operations

### Test-Driven Development (TDD)

Always write tests before implementation:

- Write a failing test first, then write the minimum code to make it pass, then refactor
- Test behavior, not implementation details — tests should describe what the system does, not how it does it internally
- Do not test framework or library behavior (e.g. don't test that Hono routes dispatch correctly, trust the framework)
- Prefer integration-style tests for use cases over unit tests for individual functions where possible
- A feature is not done until its tests pass

### Build only what's needed

Don't introduce infrastructure, patterns, or abstractions until there's a concrete need. No speculative tooling.

### Monorepo Structure

- `backend/` — `@forkcast/backend`
- `frontend/` — `@forkcast/frontend`
- `pnpm-workspace.yaml` — workspace declarations
- Root `package.json` orchestrates cross-workspace scripts

### Commands

```bash
# Install all workspace dependencies
pnpm install

# Run all workspaces in parallel
pnpm dev

# Run a command in a specific workspace
pnpm --filter @forkcast/backend <command>
pnpm --filter @forkcast/frontend <command>

# Add a dependency to a specific workspace
pnpm --filter @forkcast/backend add <pkg>
pnpm --filter @forkcast/frontend add <pkg>

# Add a dev dependency to the root
pnpm add -Dw <pkg>
```

---

## Backend

**Stack:** Hono + `@hono/node-server`, TypeScript, ESM, Vitest, oxlint + oxfmt, `node --watch` (no bundler)

**Persistence:** JSON file — no database engine yet. Add one when there's a concrete need.

**No containerization** — add Docker/compose when it's actually needed.

### Hexagonal Architecture (ports & adapters)

Keep domain code free of technical dependencies:

- Domain logic lives in the core — no framework imports, no ORM types, no HTTP concerns
- Ports define what the domain needs (interfaces); adapters implement them (DB, HTTP, external APIs)
- Infrastructure (database, HTTP layer, third-party services) plugs into the domain via adapters, never the other way around

### CQRS

Separate reads from writes — not for performance, but for clarity:

- Commands express intent (`PlanMeal`, `AddRecipe`, `LogIngredient`) — they change state
- Queries are purpose-built for the UI's needs — they can cut across domain boundaries freely
- No shared read/write models; each side is optimized for its own concern
- No Event Sourcing at this stage

### API Design

The API should tell the domain story, not the database story:

- Endpoints and operations use domain language (`/plan-meal`, `/add-to-grocery-list`) rather than generic REST resource verbs
- Request/response shapes reflect business intent, not entity structure

---

## Frontend

**Stack:** Vite + React 18 + TypeScript, Tailwind CSS v3, shadcn/ui (Radix UI primitives + CVA), React Query v5, React Hook Form + Zod, Vitest + RTL + MSW, vite-plugin-pwa + Workbox, vaul (drawers), lucide-react (icons), oxlint + oxfmt

**Dev proxy:** `/api → localhost:3000` — all API calls go through this in development

**State management:**
- Server state: React Query — all remote data lives here
- UI state: local `useState` / `useReducer` — no global client state library

**Module structure:** feature folders mirror domain language (e.g. `features/daily-log/`, `features/log-ingredient/`) — DDD ubiquitous language applies here too
