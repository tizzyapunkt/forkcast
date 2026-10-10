---
name: forkcast-dev
description: Operational dev loop for the forkcast repo — the exact verify/test/lint/typecheck/format commands, the backend smoke-test recipe, the OpenSpec change workflow, and known gotchas. Use when developing, testing, or verifying changes in this repo so you don't reinvent commands or re-diagnose pre-existing noise.
metadata:
  author: forkcast
  version: "1.0"
---

# forkcast dev loop

Architecture/domain rules live in `AGENTS.md` (read it). This skill is the **operational** layer: how to run, test, and verify. Prefer the `make` targets — they encode the right scoping and are kept green.

## The verify gate

```bash
make check        # lint + typecheck + fmt-check + tests (backend, frontend) + website build. MUST be green before committing.
```

Individual pieces (all wrap pnpm workspace scripts):

```bash
make test                 # pnpm -r test (backend + frontend)
make test-backend         # pnpm --filter @forkcast/backend test
make test-frontend
make typecheck            # pnpm -r typecheck
make lint                 # vp lint (config in root vite.config.ts)
make fmt                  # vp fmt write, scoped to backend/src frontend/src website/src website/vite.config.ts
make fmt-check            # vp fmt --check, same scope
```

Landing page (`website/`):

```bash
make website-dev          # dev server on :5174 (no tracking, form not live)
make website-build        # production build into website/dist (settings from website/.env.production)
make website-preview      # build + serve on :4173; Umami ignores it (UMAMI_DOMAINS)
```

Run a single test file during TDD (from the workspace dir, e.g. `backend/`):

```bash
pnpm exec vp test run src/path/to/file.test.ts
```

## Smoke test (backend, no API key needed)

```bash
make smoke        # boots backend with throwaway auth, runs the auth → confirm → search → export round-trip
make kill-port    # frees :3000 if a stray backend is listening
```

`make smoke` is non-destructive: it backs up and restores `backend/data/catalog.json`. It exercises the non-AI catalog path end-to-end (confirm → search → edit → export → delete). The **AI** propose path needs a real `ANTHROPIC_API_KEY` and is best verified in the browser/app.

To boot the backend manually (it requires auth env or it exits):

```bash
cd backend && AUTH_PASSWORD=x AUTH_JWT_SECRET=y node --experimental-transform-types src/index.ts
```

## Browser smoke test (full app, incl. the AI path)

`make smoke` covers the backend round-trip but not the real UI or the AI propose
call. To verify the whole flow in a browser, **always run with SSL off** — the
self-signed `basic-ssl` cert makes the Chrome automation tools choke and forces a
warning click-through:

```bash
make dev-http     # backend (:3000) + frontend over plain http://localhost:5173
```

This sets `FORKCAST_NO_HTTPS=1`, which drops the `basicSsl()` Vite plugin (default
dev stays HTTPS). The backend reads `backend/.env` — for the AI resolution path
that file needs `AUTH_PASSWORD`, `AUTH_JWT_SECRET`, and `ANTHROPIC_API_KEY`.

Then drive it with the Chrome tools (`mcp__claude-in-chrome__*`): call
`tabs_context_mcp` first, open a tab on `http://localhost:5173`, log in, and
exercise **the functionality that the current change actually implements** —
walk its real user flow, assert the behavior its spec/tasks describe, and try the
edge cases. The skill can't enumerate this; derive it from what you just built.

The steps below are **only an illustrative example** (the resolve-unmatched-
ingredients flow), not a script to run every time:

1. Rezepte → **Aus Fotos** → upload a recipe photo with off-catalog ingredients.
2. On **Rezept prüfen**, confirm the unmatched panel prefetched proposals (the
   "Zuordnen" buttons go live), open one, confirm/edit a new-food or synonym.
3. The row leaves the panel and joins the ingredient list with its amount intact; save.
4. Re-import the same recipe → the resolved ingredients now auto-match (CATALOG).
5. Settings → Sicherung herunterladen → confirm it downloads and the catalog still lists the same count.

Avoid triggering native dialogs (`alert`/`confirm`) — they freeze the extension.
This matches the standing instruction: disable HTTPS in Vite before browser smoke
testing (now via `make dev-http`, no manual `vite.config.ts` edit needed).

## Landing-page screenshots

The website's app screenshots (`website/public/screenshots/<en|de>/`) come from the real app with seeded demo data: `scripts/demo/seed-demo-data.mts` seeds a week through the API, `scripts/demo/capture-screenshots.mjs` drives the frontend with Playwright. Both scripts document their env in their headers. Recipe, once per locale:

```bash
# 1. Throwaway backend: a scratch dir with only the catalog, so backend/data stays untouched.
#    The backend resolves ./data relative to its cwd. Free :3000 first (make kill-port).
D=$(mktemp -d) && mkdir $D/data && cp backend/data/catalog.json $D/data/
(cd $D && AUTH_PASSWORD=demo AUTH_JWT_SECRET=demo-secret-0123456789abcdef \
  node --experimental-transform-types "$OLDPWD/backend/src/index.ts") &
# 2. Seed (refuses when recipes exist; a fresh dir per locale, because names are stored per language).
LOCALE=en FORKCAST_PASSWORD=demo node scripts/demo/seed-demo-data.mts
# 3. Capture against the frontend dev server (pnpm --filter @forkcast/frontend dev, proxies /api to :3000).
LOCALE=en FORKCAST_PASSWORD=demo CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx -y -p playwright-core@1.63 node scripts/demo/capture-screenshots.mjs [shot]
# 4. Copy <shot>.webp and <shot>-600.webp (phone) / <shot>-1440.webp (desktop) from scripts/demo/out/<locale>/
#    into website/public/screenshots/<locale>/; og.jpg goes to website/public/og-<locale>.jpg.
```

What the page relies on:

- Phone shots are 390x844 at 3x (1170x2532), no status bar. The website's phone frame (`.device`, drawn by `website/public/device-body.svg` + `device-bezel.svg`, 436x891 units) expects that ratio and has no Dynamic Island, since it would cover the app header.
- The capture adds the iPhone's 34px home-indicator gutter under the bottom nav and sheets (headless Chrome reports no safe-area insets). Without it the tab labels run into the frame's rounded corners and under its home indicator bar. Tailwind `@theme inline` bakes `env()` into the `pb-safe-b` / `pb-nav-safe` utilities, so the script overrides those classes, not the tokens.
- The seed plans the current week (`WEEK_START` overrides it in both scripts) and is deliberately imperfect: Wednesday under goal, Friday and Saturday over (pizza, beer, crisps), the rest on target, so the week plan shows every day tone. The capture pins the browser clock into that week, so shots don't depend on the day you run it: Saturday for the daily log (the over day), Monday morning for the cooking view (all planned meals still ahead, so it selects them all).

## Gotchas (don't re-diagnose these)

- **`vp fmt` at the repo root touches markdown/openspec too** (hundreds of files). Only ever format the source dirs — use `make fmt`, never bare `vp fmt`.
- **`openspec` CLI must run from the repo root**, not from `backend/` (e.g. `openspec validate <change>`, `openspec status --change <name>`).
- **macOS has no `timeout`** — poll with a bash loop instead (see `scripts/smoke-backend.sh`).
- **Test imports come from `vite-plus/test`**, not `vitest` (lint rule `prefer-vite-plus-imports`).
- **`vitest` mock fns need a type param** (`vi.fn<() => void>()`) and `.rejects.toThrow()` needs a message — the lint config enforces both.
- **`design_handoff_<feature>/` at the repo root is a Claude Design export**, dropped in temporarily for one OpenSpec change: a prototype plus screen renders, reference only, never shipped and not committed (lint ignores the pattern). Implement against the Tailwind tokens and existing primitives, never the prototype's inlined literals. None is in the tree when no handoff is in flight; the archived changes that cite one describe how it was reconciled.

## OpenSpec change workflow

Changes live in `openspec/changes/<name>/` (proposal, design, specs, tasks). Skills: `openspec-explore` (think), `openspec-propose` (create artifacts), `openspec-apply-change` (implement tasks), `openspec-archive-change` (finalize). Mark `tasks.md` checkboxes `[x]` as you complete them; `openspec validate <name>` from the repo root.
