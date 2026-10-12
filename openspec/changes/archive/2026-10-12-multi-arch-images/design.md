# Design

## Context

See proposal.md for the motivation. Current state:

- `deploy.yml` runs on `ubuntu-latest` (amd64). It sets up Buildx and runs `docker/build-push-action@v7` once per image without `platforms`, so each tag holds only `linux/amd64`. It has no QEMU step.
- Both base images, `node:24-alpine` and `nginx:alpine`, are published for amd64 and arm64.
- **Backend image:** a single stage. `pnpm install --prod` installs only pure-JS packages: Hono, node-server, the Anthropic SDK, jose, the OFF SDK and dotenv. There are no native addons and no install scripts (`--ignore-scripts`).
- **Frontend image:** a `node` build stage runs `pnpm build`. Vite+ brings platform-specific native binaries (rolldown, oxc and others) as optional dependencies, which pnpm picks for the architecture the stage runs on. The `nginx` stage only copies the static `dist/`.
- No PR checks exist. The workflow only runs on `main` or on manual dispatch, and both push to `:latest`. The author's machine has no Docker.

## Goals / Non-Goals

**Goals:**

- `:latest` of both images is one multi-platform tag with `linux/amd64` and `linux/arm64` (see the spec delta).
- No native toolchain runs under emulation.
- The compose file and the tags stay as they are.

**Non-Goals:**

- Other architectures (`arm/v7`, `riscv64`). Add them when someone asks.
- Build caching (`cache-from: type=gha`), versioned tags, or a PR build check.

## Decisions

### 1. QEMU plus Buildx on the existing runner, one `platforms` list per image

Add `docker/setup-qemu-action` before Buildx. Set `platforms: linux/amd64,linux/arm64` on both `build-push-action` steps. Buildx then pushes one manifest list per tag. If either platform fails, that image's step fails and nothing is pushed for it, so `:latest` never ends up with only one architecture.

*Alternative considered:* native arm64 runners (`ubuntu-24.04-arm`) with a merge job that stitches the manifests together. That's faster, but it doubles the jobs and needs digest juggling. These images are small, so it isn't worth it now.

### 2. The frontend build stage runs on the build platform

Change it to `FROM --platform=$BUILDPLATFORM node:24-alpine AS build`. The stage then always runs natively on the amd64 runner, with amd64 native binaries, once for both targets. Its output, static files, is the same for every architecture. Only `FROM nginx:alpine` runs per target platform, and it only copies files.

Running the stage under QEMU instead would emulate rolldown/oxc on arm64, which is slow and a known source of flaky crashes. Rejected.

### 3. The backend stays a single stage, built per platform

Under QEMU the arm64 backend build runs `corepack` and a pure-JS `pnpm install`. That's a little slower, but there is no native code, so nothing can break that wouldn't break on amd64 too.

*Alternative considered:* install on `$BUILDPLATFORM` in a builder stage and copy `node_modules` into a per-platform runtime stage. It's faster, but it adds a stage to protect against a problem these dependencies don't have. Rejected; revisit if a native dependency ever appears.

### 4. Verify on the registry after the merge

Without local Docker, and with every workflow run pushing to `:latest`, a pre-merge dry run would either overwrite `:latest` from a branch or need a new workflow. Neither is worth it for a change this small. Instead:
- The deploy run must succeed. A failed platform build means nothing is pushed for that image (decision 1), so a broken arm64 build fails visibly and leaves the old `:latest` in place.
- `docker buildx imagetools inspect <image>:latest` must list both platforms. The Docker Hub tag page shows the same and needs no local Docker.

## Risks / Trade-offs

- [The deploy run takes longer because of the emulated backend install] → A few minutes at most, and only on `main`. Add `type=gha` caching if it starts to hurt.
- [A future backend dependency ships a native addon] → The arm64 build would then compile or fetch it under QEMU. Revisit decision 3 then. Today `--ignore-scripts` means no install script runs anyway.
- [`$BUILDPLATFORM` stops being set] → Buildx always sets it, and the workflow already uses Buildx.

## Migration Plan

Nothing for users. The next `docker compose pull` on an ARM host gets a native image instead of failing or running emulated. On amd64 hosts nothing changes. Rollback means reverting the workflow; the previous single-arch push then becomes `:latest` again.
