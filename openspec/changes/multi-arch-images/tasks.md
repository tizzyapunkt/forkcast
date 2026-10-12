# Tasks

## 1. Build both architectures

- [x] 1.1 In `frontend/Dockerfile`, run the build stage on the build platform (`FROM --platform=$BUILDPLATFORM node:24-alpine AS build`), with a one-line comment saying why; verify the nginx stage still starts from plain `nginx:alpine`
- [x] 1.2 In `.github/workflows/deploy.yml`, add `docker/setup-qemu-action` before the Buildx step and `platforms: linux/amd64,linux/arm64` to both `build-push-action` steps; verify the workflow file parses (`gh workflow view deploy` after push, or a YAML lint) and that tags and secrets are unchanged

## 2. Docs

- [x] 2.1 Remove "Images are `linux/amd64` only for now." from the README's self-hosting section, and add "for amd64 and arm64" to the Deployment line in `AGENTS.md`; verify `grep -n "amd64" README.md AGENTS.md` shows only the new wording

## 3. Integration check

- [x] 3.1 Run `make check` and verify it passes (nothing in it builds images, but the Dockerfile and docs changes must not break lint or format)
- [ ] 3.2 After the merge to `main`, verify that the `deploy` run succeeds and that `docker buildx imagetools inspect tizzyapunkt/forkcast-backend:latest` and `…/forkcast-frontend:latest` list both `linux/amd64` and `linux/arm64` (or the Docker Hub tag pages show both)

## Workflow follow-up

- Archive the change after 3.2 has passed; archiving syncs the `container-deployment` delta.
