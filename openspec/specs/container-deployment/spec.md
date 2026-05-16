# container-deployment

## Purpose

Package the forkcast backend and frontend as container images that can be built locally and orchestrated together via Docker Compose, so the full stack runs reproducibly on the user's home server (and any future deploy target) without bespoke per-host installation steps. The backend image bundles the curated `foods.json` so it boots without external data dependencies; the frontend image serves the built React app via nginx and proxies `/api` to the backend over a shared internal network.

## Requirements

### Requirement: Backend Docker image is buildable and self-contained
The system SHALL provide a `backend/Dockerfile` that produces a runnable image containing the Hono server, all production dependencies, and the curated `foods.json` food database. The image SHALL start the server on port 3000 using `node --experimental-transform-types`.

#### Scenario: Backend image starts successfully
- **WHEN** `docker build -t forkcast-backend ./backend` is run and then the container is started
- **THEN** the server starts and responds to requests on port 3000

#### Scenario: foods.json is available inside the image
- **WHEN** the backend container starts
- **THEN** the curated foods database is loaded from `/app/backend/data/foods.json` without requiring any external volume

### Requirement: Frontend Docker image builds and serves the app via nginx
The system SHALL provide a `frontend/Dockerfile` that builds the Vite/React app and serves the static output via nginx on port 80. The image SHALL include an nginx config that proxies `/api` requests to `http://backend:3000`.

#### Scenario: Frontend static files are served correctly
- **WHEN** the frontend container is running
- **THEN** accessing port 80 returns the React app's `index.html`

#### Scenario: API requests are proxied to the backend
- **WHEN** the frontend container receives a request at `/api/*`
- **THEN** nginx proxies it to `http://backend:3000` and returns the response

#### Scenario: SPA routes do not 404
- **WHEN** a user navigates directly to a client-side route (e.g., `/plan`)
- **THEN** nginx serves `index.html` so the React router handles it

### Requirement: Docker Compose orchestrates the full stack
The system SHALL provide a `docker-compose.yml` at the repo root that defines both the `backend` and `frontend` services, connects them on a shared internal network, and mounts a named volume for backend runtime data.

#### Scenario: Full stack starts with a single command
- **WHEN** `docker compose up -d` is run on the home server
- **THEN** both the backend and frontend containers start and the app is accessible

#### Scenario: Backend runtime data persists across container restarts
- **WHEN** the backend container is stopped and restarted
- **THEN** log entries and recipes written before the restart are still available

#### Scenario: foods.json is not overridden by the data volume
- **WHEN** the data volume is mounted at `/app/backend/data`
- **THEN** the `foods.json` file baked into the image is copied into the data volume on container start so the running server reads the image's curated dataset, not a stale copy from the volume

### Requirement: GitHub Actions publishes Docker images to Docker Hub on push to main
The system SHALL provide a `.github/workflows/deploy.yml` CI workflow that builds both Docker images and pushes them to Docker Hub when a commit is pushed to the `main` branch. The workflow SHALL use `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets.

#### Scenario: Images are pushed on main branch push
- **WHEN** a commit is pushed to `main`
- **THEN** the CI workflow builds both images and pushes them tagged as `<username>/forkcast-backend:latest` and `<username>/forkcast-frontend:latest`

#### Scenario: Workflow is triggerable manually
- **WHEN** the workflow is dispatched manually via `workflow_dispatch`
- **THEN** it builds and pushes images the same way as a push trigger
