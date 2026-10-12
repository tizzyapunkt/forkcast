## MODIFIED Requirements

### Requirement: GitHub Actions publishes Docker images to Docker Hub on push to main
The system SHALL provide a `.github/workflows/deploy.yml` CI workflow that builds both Docker images and pushes them to Docker Hub when a commit is pushed to the `main` branch. The workflow SHALL use `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets. Each published tag SHALL be a multi-platform image covering `linux/amd64` and `linux/arm64`, so the same tag pulls a native image on both architectures without the user choosing a platform.

#### Scenario: Images are pushed on main branch push
- **WHEN** a commit is pushed to `main`
- **THEN** the CI workflow builds both images and pushes them tagged as `<username>/forkcast-backend:latest` and `<username>/forkcast-frontend:latest`

#### Scenario: Workflow is triggerable manually
- **WHEN** the workflow is dispatched manually via `workflow_dispatch`
- **THEN** it builds and pushes images the same way as a push trigger

#### Scenario: Published tags cover amd64 and arm64
- **WHEN** the workflow has pushed `<username>/forkcast-backend:latest` and `<username>/forkcast-frontend:latest`
- **THEN** each tag's manifest lists a `linux/amd64` and a `linux/arm64` image

#### Scenario: An ARM host runs the stack natively
- **WHEN** `docker compose up -d` runs on a `linux/arm64` host with the repository's `docker-compose.yml`
- **THEN** both containers start from their `linux/arm64` images, without emulation and without a `platform:` override in the compose file
