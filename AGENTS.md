# AGENTS.md

## Cursor Cloud specific instructions

### Overview

forkcast is a pnpm monorepo with two packages: `@forkcast/backend` (Hono API on port 3000) and `@forkcast/frontend` (Vite React PWA on port 5173). See `CLAUDE.md` for full architecture and command reference.

### Environment

- **Node.js 22+** is required (backend uses `--experimental-transform-types`).
- **pnpm 10.33.0** — managed via corepack (`corepack enable && corepack prepare pnpm@10.33.0 --activate`).
- No database, Docker, or external services needed. Persistence is via JSON files in `backend/data/`.

### Running services

- `pnpm dev` starts both backend and frontend in parallel.
- Backend: `pnpm --filter @forkcast/backend dev` (port 3000).
- Frontend: `pnpm --filter @forkcast/frontend dev` (port 5173, HTTPS with self-signed cert). Proxies `/api` to `http://localhost:3000`.

### Caveats

- The backend requires `AUTH_PASSWORD` and `AUTH_JWT_SECRET` environment variables. Create `backend/.env` from `backend/.env.example` with dev values before starting. Without these, the backend exits on startup.
- The frontend uses `@vitejs/plugin-basic-ssl` for HTTPS — accept the self-signed certificate when testing in browser.
- Data files (`backend/data/log-entries.json`, `backend/data/recipes.json`, `backend/data/nutrition-goal.json`) are created at runtime and should not be committed. `backend/data/catalog.json` is the food catalog: runtime-writable, and tracked in git because it doubles as the starting point the backend seeds a fresh data directory from.
- The backend's `node --watch` restarts on file changes but does not pick up new npm dependencies — restart the process after `pnpm install`.
- Pre-commit hook runs `pnpm lint-staged` via husky.
- Backend API routes do NOT have an `/api` prefix — the frontend Vite proxy strips `/api` before forwarding to `http://localhost:3000`. When testing the backend directly, use e.g. `curl http://localhost:3000/nutrition-goal` (not `/api/nutrition-goal`).
