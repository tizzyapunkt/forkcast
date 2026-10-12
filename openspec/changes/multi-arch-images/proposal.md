# Proposal

## Why

The published images are `linux/amd64` only. Many self-hosters run forkcast on ARM hardware (Raspberry Pi, Apple Silicon, ARM NAS boxes, ARM cloud instances), and a Show HN audience will try exactly that. Today `docker compose up` on those machines either fails or runs under emulation.

## What Changes

- `.github/workflows/deploy.yml` builds and pushes both images for `linux/amd64` and `linux/arm64` as one multi-arch manifest per tag (QEMU + Buildx).
- The frontend image's build stage runs on the build platform, since its output (static files) is architecture-independent; only the nginx stage is per-architecture.
- The README drops the "Images are `linux/amd64` only for now" note.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `container-deployment`: the published images are multi-arch manifests covering `linux/amd64` and `linux/arm64`, so the same tags pull natively on both.

## Impact

- `.github/workflows/deploy.yml`, `frontend/Dockerfile` (build stage platform), `backend/Dockerfile` if a dependency needs per-arch handling, `README.md`.
- CI time goes up (arm64 under QEMU); the backend has no native modules, so emulated install stays cheap.
- No change to tags, compose file or runtime behavior.
