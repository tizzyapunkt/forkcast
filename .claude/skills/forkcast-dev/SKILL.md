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

## Gotchas (don't re-diagnose these)

- **`oxfmt` at the repo root touches markdown/openspec too** (hundreds of files). Only ever format the source dirs — use `make fmt`, never bare `oxfmt`.
- **`openspec` CLI must run from the repo root**, not from `backend/` (e.g. `openspec validate <change>`, `openspec status --change <name>`).
- **macOS has no `timeout`** — poll with a bash loop instead (see `scripts/smoke-backend.sh`).
- **`vitest` mock fns need a type param** (`vi.fn<() => void>()`) and `.rejects.toThrow()` needs a message — the lint config enforces both.
- The `design_handoff_*` dirs are HTML/React prototypes (reference only, never shipped) and are excluded from lint.

## OpenSpec change workflow

Changes live in `openspec/changes/<name>/` (proposal, design, specs, tasks). Skills: `openspec-explore` (think), `openspec-propose` (create artifacts), `openspec-apply-change` (implement tasks), `openspec-archive-change` (finalize). Mark `tasks.md` checkboxes `[x]` as you complete them; `openspec validate <name>` from the repo root.
