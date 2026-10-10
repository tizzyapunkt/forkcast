# AGENTS.md

## Project

forkcast is a mobile-first, planning-first meal planning and nutrition tracking PWA (offline, installable, full desktop support). Weekly meal planning against user-defined calorie/macro goals, recipe and ingredient management, grocery lists from the plan. Every interaction must be fast and low-friction — the user's constraint is time. Built for personal use; keep it clean enough to become a product. Licensed AGPL-3.0-only: keep the copyright and license notice in Settings (the AGPL's "Appropriate Legal Notices").

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
pnpm --filter @forkcast/<backend|frontend|website> <command|add pkg>
pnpm add -Dw <pkg>                        # root dev dependency
make help                                 # all targets; `make check` is the gate (incl. website build)
```

## Backend

Hono + `@hono/node-server`, TypeScript, ESM, Vite+ (`vp test` / `vp lint` / `vp fmt`), `node --watch` (no bundler). Persistence is JSON files in `backend/data/` — no DB until needed.

- **Hexagonal:** domain core has no framework/HTTP/persistence imports; ports are interfaces, adapters implement them.
- **CQRS** for clarity: commands express intent (`PlanMeal`, `AddRecipe`); queries are shaped for the UI and may cross boundaries; no shared read/write models; no event sourcing.
- **API** uses domain language (`/plan-meal`, `/add-to-grocery-list`), not generic REST; shapes reflect business intent.

## Frontend

Vite + React 19 + TS, Tailwind v4 (CSS-first, theme in `components/ui/tokens.css`), shadcn/ui (Radix + CVA), React Query v5 (all server state), React Hook Form + Zod, Vite+ (`vp`: dev/build/test/lint/fmt), RTL + MSW, vite-plugin-pwa, vaul, lucide-react. UI state is local `useState`/`useReducer` — no global store. Feature folders use domain language (`features/daily-log/`).

**Design system:** `components/ui/` holds domain-free primitives (`Button`, `Input`, `DecimalInput`, `Select`, `Card`, `Field`, `Banner`, `SegmentedControl`) built with CVA over tokens in `components/ui/tokens.css` — the single place for colours, radii, focus rings.

- Use a primitive before hand-writing control classes; if none fits, add a variant there.
- Pass layout/one-off overrides via `className` (merged by `cn()` in `lib/cn.ts`).
- `components/app/` holds app-aware composites (header, bottom nav, sheets, error banner).
- `<textarea>` gets a primitive once a second call site needs one.
- New primitives are exported from `components/ui/index.ts`; publishing them to Claude Design is in [Design workflow](#design-workflow).

## Website

Public landing page at https://check-forkcast.tizzy.dev (EN at `/`, DE at `/de/`, plus privacy policy and imprint in both languages) with an interest check for hosted vs. self-hosted use. Plain HTML + a little vanilla JS, built by Vite+ as a multi-page app — no framework, no React, independent of the app's design system; a new page needs an entry in `website/vite.config.ts`.

- Production settings are committed in `website/.env.production` (not secret, they end up in the HTML): Umami script, website ID and `UMAMI_DOMAINS`, and one Tally form per language (`TALLY_FORM_ID_EN` / `_DE`). Dev builds without them never track; `.env.example` documents every key.
- Ticking hosted / self-host counts the vote as a cookieless Umami event (`interest`). The button only opens the optional launch e-mail on Tally, prefilled with the choice. The page itself never asks for an e-mail; keep it that way, the privacy policy says so.
- `.github/workflows/website.yml` deploys to GitHub Pages on pushes to `main` that touch `website/`.
- App screenshots are real captures of the seeded demo app (`scripts/demo/`), not mockups. Recapture recipe and what the phone frame relies on: the `forkcast-dev` skill, _Landing-page screenshots_.

## Design workflow

`frontend/` and `website/` are two separate design worlds. Each has its own product and design records; they share only the brand lilac (`244 36% 44%`). The code is the source of truth (`frontend/src/components/ui/tokens.css` + the primitives, `website/src/styles.css`); the records describe it and must not drift from it. Behaviour changes still go through OpenSpec (`openspec/changes/`); the design workflow covers how things look and feel.

**Tools**

- **Impeccable** (`/impeccable <command> [target]`, vendored in `.claude/skills/impeccable/`): product and design context, design commands (`shape`, `critique`, `audit`, `polish`, `layout`, `typeset`, `live`, …) and the record keeping below. Its hook (`.claude/settings.json`, `.cursor/hooks.json`, `.github/hooks/impeccable.json`) runs the design detector after UI edits and reports findings.
- **Claude Design** (`/design-sync`, needs `/design-login`, local terminal only): publishes the frontend's `components/ui/` primitives to the Claude Design project, so designs made there use the real components. Website is not synced. A finished design comes back as a handoff export, `design_handoff_<feature>/` at the repo root: a prototype plus screen renders, reference only, never shipped or committed (lint ignores the pattern).

**Which tool designs what**

- **App screens and flows (`frontend/`): Claude Design**, then OpenSpec, then Impeccable. Design the screens and their states in Claude Design. Drop the handoff into the repo root and cite it in the OpenSpec change's `design.md`. Implement against the tokens and primitives, never the prototype's inlined values. Check the result against the renders, then run `/impeccable critique|polish` on the built screens. If the system changed, finish with step 3 of _Order_ below.
- **Website pages (`website/`): Impeccable end to end.** The page is plain HTML with no synced components, so the code is the canvas: `/impeccable shape` → build → finish review → `document`.
- **Small visual fixes anywhere:** Impeccable directly, no Claude Design round.

**Files, per workspace (`frontend/`, `website/`)**

| File                                                      | What                                                                                                                                                           | Owner                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `PRODUCT.md`                                              | Product truth: users, purpose, brand commitments, principles. No visuals.                                                                                      | `/impeccable init`                               |
| `DESIGN.md`                                               | Visual system: tokens in the YAML frontmatter, named rules and components in prose.                                                                            | `/impeccable document`                           |
| `.impeccable/design.json`                                 | Sidecar generated from `DESIGN.md`: tonal ramps, shadows, motion, breakpoints, HTML/CSS snippets per component (rendered by `live` mode). Not read by the app. | regenerated with `DESIGN.md`, never edited alone |
| `.impeccable/surfaces/<slug>.md`                          | Surface brief for one page (mode, direction contract), e.g. the landing page.                                                                                  | written by new work on that surface              |
| `.impeccable/config.json`, `.impeccable/live/config.json` | Hook settings; which files `live` mode injects into.                                                                                                           | Impeccable                                       |

Gitignored, never commit: `.impeccable/config.local.json`, `hook.cache.json`, `questions/`, `review/`, `critique/`.

Claude Design files: `.design-sync/config.json` (project and build command), `conventions.md` (the README Claude Design reads), `previews/*.tsx` (one preview per primitive), `NOTES.md` (sync gotchas; read before a re-sync). Build output is gitignored: `frontend/dist-ui/`, `ds-bundle/`, `.ds-sync/`.

**Order**

1. **New surface or redesign without a handoff** (the website, or an app screen designed in code): `PRODUCT.md` must exist (`/impeccable init` writes it). Then `/impeccable shape <feature>` (or a plain design request): direction, then the surface brief, then build, then the finish review. Close with `/impeccable document target <workspace>`, which writes `DESIGN.md` and the sidecar.
2. **Refinement:** `/impeccable <critique|audit|polish|layout|…> <target>` works on the existing world and keeps it. Fix what the hook reports in the same change.
3. **The system changed** (a token, a primitive, a layout rule, a new motion): run `/impeccable document target <workspace>` in the same PR and pick _merge_. That updates `DESIGN.md` and regenerates the sidecar.
4. **`components/ui/` changed:** run `pnpm --filter @forkcast/frontend build:ui` first, then `/design-sync`. Running the sync against a stale `dist-ui/` under-reports silently. A new primitive also needs a preview in `.design-sync/previews/` and a line in `conventions.md`.
5. **Drift check:** run `/impeccable doctor`. In this monorepo the root report is always empty, so the useful part is the per-workspace report (doctor runs `--target frontend` / `--target website`). A stale sidecar is fixed with step 3.

## Environment & caveats

- Node 24 LTS (backend uses `--experimental-transform-types`); pnpm 12 via corepack (`corepack enable`; the version comes from `packageManager`). pnpm enforces a 1-day `minimumReleaseAge` — a package published in the last 24h won't resolve until it ages (or is listed in `minimumReleaseAgeExclude`).
- Backend needs `AUTH_PASSWORD` and `AUTH_JWT_SECRET` — copy `backend/.env.example` to `backend/.env`, or it exits on startup.
- Frontend serves HTTPS with a self-signed cert (`@vitejs/plugin-basic-ssl`) and proxies `/api` → `localhost:3000`, **stripping** `/api`. Hit the backend directly without it: `curl http://localhost:3000/nutrition-goal`.
- Runtime data files in `backend/data/` are not committed, except `catalog.json` (food catalog, tracked as the seed for a fresh data dir).
- `node --watch` doesn't pick up new dependencies — restart after `pnpm install`.
- Tooling is Vite+ (`vite-plus`): lint/fmt/staged config lives in the root `vite.config.ts`; tests import from `vite-plus/test` (lint enforces it).
- Pre-commit runs `vp staged` (`.vite-hooks/pre-commit`); `pnpm install` installs the hook via `vp config`.
- Deployment: `.github/workflows/deploy.yml` builds and pushes the backend and frontend (nginx) images to Docker Hub (`tizzyapunkt/forkcast-*`, public) on every push to `main`. The root `docker-compose.yml` is the self-host setup documented in the README; the frontend's nginx config is a template whose DNS resolver comes from the container (works under Docker and Podman).
