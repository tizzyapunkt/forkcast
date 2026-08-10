# container-deployment — delta

The boot rule inverts. Today the entrypoint copies the image's `foods.json` over the data volume on **every** start, which is what makes the catalog unwritable at runtime. It becomes a seed-if-absent install: the bundled starting point is used only when the volume has no catalog, so user edits survive every deploy.

## MODIFIED Requirements

### Requirement: Backend Docker image is buildable and self-contained
The system SHALL provide a `backend/Dockerfile` that produces a runnable image containing the Hono server, all production dependencies, and a bundled starting-point food catalog stored outside the data volume. The image SHALL start the server on port 3000 using `node --experimental-transform-types`.

#### Scenario: Backend image starts successfully
- **WHEN** `docker build -t forkcast-backend ./backend` is run and then the container is started
- **THEN** the server starts and responds to requests on port 3000

#### Scenario: Fresh container serves the bundled catalog
- **WHEN** the backend container starts with an empty data volume
- **THEN** the bundled starting-point catalog is installed into the data directory and served, without requiring any externally supplied data file

### Requirement: Docker Compose orchestrates the full stack
The system SHALL provide a `docker-compose.yml` at the repo root that defines both the `backend` and `frontend` services, connects them on a shared internal network, and mounts a named volume for backend runtime data. The food catalog SHALL be treated as runtime data living in that volume.

#### Scenario: Full stack starts with a single command
- **WHEN** `docker compose up -d` is run on the home server
- **THEN** both the backend and frontend containers start and the app is accessible

#### Scenario: Backend runtime data persists across container restarts
- **WHEN** the backend container is stopped and restarted
- **THEN** log entries, recipes, and the food catalog written before the restart are still available

#### Scenario: Catalog in the data volume is never overwritten by the image
- **WHEN** the data volume mounted at `/app/backend/data` already contains a catalog and a container with a different bundled starting point is started
- **THEN** the volume's catalog is left untouched and is the one the server reads

#### Scenario: Catalog installed only when the volume has none
- **WHEN** the data volume mounted at `/app/backend/data` contains no catalog file and the container starts
- **THEN** the bundled starting point is copied into the volume once and used from there on subsequent starts
