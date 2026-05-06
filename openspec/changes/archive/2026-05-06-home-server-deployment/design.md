## Context

Forkcast is a pnpm monorepo with two workspaces: `backend/` (Hono/Node.js, TypeScript ESM, no build step) and `frontend/` (Vite/React, PWA). The backend persists data as JSON files under `./data/` and loads `bls.json` (the pre-built BLS food database) at startup. The reference deployment pattern comes from the tizzydotdev repo: GitHub Actions builds a Docker image and pushes it to Docker Hub; the home server pulls and runs it.

## Goals / Non-Goals

**Goals:**
- Docker images for both backend and frontend buildable via GitHub Actions
- Images pushed to Docker Hub on every push to `main`
- `docker-compose.yml` at repo root so the home server can run the full stack with a single command
- Backend runtime JSON data (log entries, recipes) persisted across container restarts via a named volume
- `bls.json` food database baked into the backend image (it's generated from source data and rarely changes)
- Frontend nginx proxies `/api` requests to the backend container (same pattern as the Vite dev proxy)

**Non-Goals:**
- HTTPS termination (handled upstream by home server reverse proxy / Traefik / Caddy)
- Database migration tooling (the JSON file format is append-friendly; no migrations needed at this stage)
- Multi-architecture builds (the home server is x86-64)

## Decisions

### Decision 1: Backend runs TypeScript directly (no transpile step)

**Choice:** Keep `node --experimental-transform-types src/index.ts` in the Docker image.

**Rationale:** The backend already uses this in both dev and prod (`start` script). Adding a tsc build step just to produce JS would require tsconfig changes, output directory management, and path mapping — non-trivial overhead with no runtime benefit. Node 22 supports the flag in production; the flag is stable enough for personal use.

**Alternative considered:** Compile to JS with `tsc`, serve from `dist/`. Rejected because it adds complexity and the project's own `start` script already avoids it.

### Decision 2: Frontend nginx proxies `/api` to the backend

**Choice:** nginx config with `location /api { proxy_pass http://backend:3000; }`.

**Rationale:** Mirrors the Vite dev proxy setup exactly — the frontend code assumes `/api` is local, no env var needed. Works cleanly in docker-compose where the backend container is named `backend`.

**Alternative considered:** Inject `VITE_API_URL` at build time. Rejected because it couples the build to the deployment URL and requires a rebuild to change; the proxy approach is transparent to application code.

### Decision 3: Separate Dockerfiles per service, shared docker-compose

**Choice:** `backend/Dockerfile` and `frontend/Dockerfile`, composed at root.

**Rationale:** Each service has a different base image and build process. Keeping them separate keeps each Dockerfile minimal and independently buildable. The root `docker-compose.yml` is the composition layer.

**Alternative considered:** A single multi-stage Dockerfile at the root. Rejected because managing two unrelated build pipelines in one file is messy and makes CI image tagging awkward.

### Decision 4: bls.json baked into the backend image

**Choice:** Copy `backend/data/bls.json` into the image at build time.

**Rationale:** `bls.json` is a generated artifact checked into the repo. It's large and read-only at runtime. Baking it in avoids volume complexity and makes the image self-contained. It's only rebuilt when BLS source data changes, which is rare.

**Alternative considered:** Mount `bls.json` via a volume. Rejected because it requires the home server to have the file available separately, adding operational complexity.

### Decision 5: Runtime data in a named Docker volume

**Choice:** `forkcast_data` named volume mounted at `/app/data` in the backend container.

**Rationale:** `log-entries.json` and `recipes.json` are written at runtime and must survive container restarts and image upgrades. A named volume is the standard Docker pattern for this.

## Risks / Trade-offs

- [bls.json in image inflates image size] → Acceptable for personal use; multi-stage build keeps everything else lean.
- [--experimental-transform-types flag] → Still experimental in Node 22; could break on Node version bumps. Mitigation: pin Node version in Dockerfile.
- [JSON file persistence] → Not suitable for concurrent writes or large datasets, but sufficient for personal single-user use as established by the existing architecture.
- [No health checks in docker-compose] → The home server's update workflow (`docker compose pull && docker compose up -d`) will bring up containers regardless. Add health checks when there's a concrete need.

## Migration Plan

1. Create Dockerfiles and nginx config — verify local `docker compose up` works
2. Push CI workflow — verify images are published to Docker Hub
3. On home server: `docker compose pull && docker compose up -d`
4. Confirm app accessible at home server IP/hostname

Rollback: `docker compose up -d --scale backend=0 frontend=0` or roll back to previous image tag.
