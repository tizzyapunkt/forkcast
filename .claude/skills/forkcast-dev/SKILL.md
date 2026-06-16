---
name: forkcast-dev
description: Operational dev loop for the forkcast repo — the exact verify/test/lint/typecheck/format commands, the backend smoke-test recipe, the OpenSpec change workflow, and known gotchas. Use when developing, testing, or verifying changes in this repo so you don't reinvent commands or re-diagnose pre-existing noise.
metadata:
  author: forkcast
  version: "1.0"
---

# forkcast dev loop

Architecture/domain rules live in `CLAUDE.md` (read it). This skill is the **operational** layer: how to run, test, and verify. Prefer the `make` targets — they encode the right scoping and are kept green.

## The verify gate

```bash
make check        # lint + typecheck + fmt-check + tests (both workspaces). MUST be green before committing.
```

Individual pieces (all wrap pnpm workspace scripts):

```bash
make test                 # pnpm -r test (backend + frontend)
make test-backend         # pnpm --filter @forkcast/backend test
make test-frontend
make typecheck            # pnpm -r typecheck
make lint                 # oxlint (config at .oxlintrc.json)
make fmt                  # oxfmt write, scoped to backend/src backend/scripts frontend/src
make fmt-check            # oxfmt --check, same scope
```

Run a single test file during TDD (from the workspace dir, e.g. `backend/`):

```bash
pnpm vitest run src/path/to/file.test.ts
```

## Smoke test (backend, no API key needed)

```bash
make smoke        # boots backend with throwaway auth, runs the auth → confirm → search → export round-trip
make kill-port    # frees :3000 if a stray backend is listening
```

`make smoke` is non-destructive: it backs up and restores `backend/data/user-foods.json`. It exercises the non-AI resolution path end-to-end. The **AI** propose path needs a real `ANTHROPIC_API_KEY` and is best verified in the browser/app.

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
4. Re-import the same recipe → the resolved ingredients now auto-match (USER).
5. Settings → export overlay → confirm it downloads and drains.

Avoid triggering native dialogs (`alert`/`confirm`) — they freeze the extension.
This matches the standing instruction: disable HTTPS in Vite before browser smoke
testing (now via `make dev-http`, no manual `vite.config.ts` edit needed).

## Gotchas (don't re-diagnose these)

- **`oxfmt` at the repo root touches markdown/openspec too** (hundreds of files). Only ever format the source dirs — use `make fmt`, never bare `oxfmt`.
- **`openspec` CLI must run from the repo root**, not from `backend/` (e.g. `openspec validate <change>`, `openspec status --change <name>`).
- **macOS has no `timeout`** — poll with a bash loop instead (see `scripts/smoke-backend.sh`).
- **`vitest` mock fns need a type param** (`vi.fn<() => void>()`) and `.rejects.toThrow()` needs a message — the lint config enforces both.
- The `design_handoff_*` dirs are HTML/React prototypes (reference only, never shipped) and are excluded from lint.

## OpenSpec change workflow

Changes live in `openspec/changes/<name>/` (proposal, design, specs, tasks). Skills: `openspec-explore` (think), `openspec-propose` (create artifacts), `openspec-apply-change` (implement tasks), `openspec-archive-change` (finalize). Mark `tasks.md` checkboxes `[x]` as you complete them; `openspec validate <name>` from the repo root.
