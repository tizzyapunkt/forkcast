## MODIFIED Requirements

### Requirement: Backend Docker image is buildable and self-contained
The system SHALL provide a `backend/Dockerfile` that produces a runnable image containing the Hono server, all production dependencies, and the curated `foods.json` food database. The image SHALL start the server on port 3000 using `node --experimental-transform-types`.

#### Scenario: Backend image starts successfully
- **WHEN** `docker build -t forkcast-backend ./backend` is run and then the container is started
- **THEN** the server starts and responds to requests on port 3000

#### Scenario: foods.json is available inside the image
- **WHEN** the backend container starts
- **THEN** the curated foods database is loaded from `/app/backend/data/foods.json` without requiring any external volume

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
