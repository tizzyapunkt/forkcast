## Context

The deployment plumbing was wired for a curated DB called `bls.json`. That file was renamed/replaced by `foods.json` in the application layer (`backend/src/index.ts:58` already reads `./data/foods.json`), but `backend/Dockerfile` and `backend/docker-entrypoint.sh` were never updated. As a result, the image build fails on `COPY backend/data/bls.json` because the file no longer exists in the repo.

The pre-existing pattern is: bake the curated DB into the image at a non-volume path (`/app/backend/foods.json.img`), then `cp` it into the data volume at startup (`/app/backend/data/foods.json`). The data volume holds user state (`recipes.json`, `log-entries.json`, `nutrition-goal.json`); the curated DB rides along but ships with image updates rather than persisting in the volume. We keep this pattern — only the file name changes.

## Goals / Non-Goals

**Goals:**
- `docker build -t forkcast-backend ./backend` succeeds.
- A started backend container has a fresh `/app/backend/data/foods.json` from the image on every start, regardless of prior volume state.
- User data on the named `forkcast_data` volume (recipes, log entries, nutrition goal) is not affected.
- The `container-deployment` spec reflects the new file name.

**Non-Goals:**
- Changing the deployment topology (compose, networking, volumes).
- Cleaning up legacy `bls.json` files that may still sit inside existing data volumes — they will simply be ignored by the running app.
- Refactoring the entrypoint into a more general bootstrap mechanism. One file, one copy step is fine.
- Touching frontend Docker assets (no BLS references there).

## Decisions

**Decision 1: Keep the "bake outside the volume, copy in on start" pattern.**
- Rationale: it already works for the BLS case and was chosen so curated-DB updates ship with image releases instead of being stuck inside a persistent volume. The `forkcast_data` volume is mounted at `/app/backend/data`, which would otherwise shadow any `data/foods.json` baked into the image.
- Alternatives considered: (a) mount the curated DB read-only from outside the volume — needs compose changes and forces the app to read from two paths; (b) drop the volume mount path overlap — would lose user-data persistence semantics. Both more invasive than the rename.

**Decision 2: Use the same image-side filename suffix (`foods.json.img`).**
- Rationale: keeps the entrypoint diff trivially small (just swap `bls` for `foods` in two lines + the COPY line). The `.img` suffix is the existing convention to distinguish the baked source from the runtime data file.
- Alternatives considered: drop the `.img` suffix and copy from `/app/backend/foods.json` → `/app/backend/data/foods.json`. Marginally cleaner, but every existing reader of the script and the existing spec scenarios talk about an "image" copy of the DB; preserving the suffix is the smaller, lower-risk delta.

**Decision 3: No cleanup of stale `bls.json` inside existing volumes.**
- Rationale: harmless leftover. The application no longer reads it, so it just sits there until the user prunes the volume. Cleanup logic adds risk (rm in a startup script) for zero functional benefit.

## Risks / Trade-offs

- **Risk**: a contributor regenerates `foods.json` via `pnpm build:foods` but forgets to rebuild the image → containers serve stale curated data. **Mitigation**: out of scope here; CI on `main` already rebuilds and pushes images on push, so committing a regenerated `foods.json` to `main` triggers a new image automatically.
- **Risk**: existing volumes that contain a `bls.json` left by old containers are not cleaned up. **Mitigation**: accepted (see Decision 3); document the leftover in the proposal's Impact section so the user isn't surprised on `docker volume inspect`.
- **Trade-off**: refreshing `foods.json` on every container start writes ~tens-of-KB to the volume on each restart. Negligible at this scale; matches existing BLS behaviour.

## Migration Plan

1. Land the Dockerfile + entrypoint changes together with the spec delta.
2. CI on `main` rebuilds and publishes `forkcast-backend:latest`.
3. On the home server, `docker compose pull && docker compose up -d` swaps in the new image. Volume data persists; the new image's entrypoint writes the new `foods.json` into the volume on first start.
4. **Rollback**: re-pull the previous image tag. The volume's `foods.json` will be overwritten by whatever the older image ships (which is `bls.json` in the rolled-back image — but the older app reads `bls.json`, so rollback is consistent end-to-end).
