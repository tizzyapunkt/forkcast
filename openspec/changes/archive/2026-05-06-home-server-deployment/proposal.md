## Why

Forkcast needs to run on a home server for daily personal use. Currently there's no deployment pipeline — the app only runs locally. The pattern used for tizzydotdev (GitHub Actions → Docker Hub → home server pulls) is the established approach for this setup.

## What Changes

- Add `backend/Dockerfile`: multi-stage image that installs production dependencies and runs the Hono server with `--experimental-transform-types`, baking in the `bls.json` food database
- Add `frontend/Dockerfile`: builds the Vite/React app and serves static files via nginx, with `/api` proxied to the backend container
- Add `frontend/nginx.conf`: nginx configuration for static file serving and API reverse proxy
- Add `docker-compose.yml` at the repo root: defines both services, mounts a data volume for backend JSON persistence, and wires up the internal network
- Add `.github/workflows/deploy.yml`: CI pipeline that builds and pushes both Docker images to Docker Hub on push to `main` (mirrors tizzydotdev's `main.yml` structure)
- Add `.dockerignore` files for backend and frontend to keep images lean

## Capabilities

### New Capabilities

- `container-deployment`: Dockerized build and deployment pipeline for both backend and frontend services, with docker-compose orchestration and GitHub Actions CI

### Modified Capabilities

<!-- none -->

## Impact

- New files only — no existing source code changes
- Backend port 3000 exposed within the Docker network; frontend nginx port 80 exposed to the host
- Backend runtime data (`log-entries.json`, `recipes.json`) persisted via a named Docker volume; `bls.json` and `nutrition-goal.json` are baked into the image
- GitHub Actions requires `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets (same as tizzydotdev)
- Home server only needs `docker compose pull && docker compose up -d` to update
