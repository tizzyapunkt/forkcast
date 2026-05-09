## Why

The backend Dockerfile and container entrypoint still bake in `backend/data/bls.json` and copy it into the data volume on each start. That file no longer exists — the BLS dataset has been replaced by the curated `foods.json` artifact. Today the image fails to build (`COPY backend/data/bls.json` cannot resolve), and even if patched naively, the entrypoint would copy a missing/wrong file. We need to update the deployment plumbing so containers ship and refresh the curated foods DB on each start, keeping user data on the named volume intact.

## What Changes

- Update `backend/Dockerfile` to copy `backend/data/foods.json` into the image as `foods.json.img` (replacing the `bls.json` line).
- Update `backend/docker-entrypoint.sh` to copy `foods.json.img` → `/app/backend/data/foods.json` on each start (replacing the `bls.json` copy step).
- Update the `container-deployment` spec's three `bls.json` scenarios/requirement texts to reference `foods.json`.
- Verify `docker-compose.yml`, the GitHub Actions deploy workflow, and the backend runtime still resolve the curated DB at the expected path; no changes expected, but call out if any are needed.

No application-code changes — backend already loads from `./data/foods.json`. No frontend changes.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `container-deployment`: requirement and scenarios that mention `bls.json` shift to `foods.json`. The deployment contract (image is self-contained, curated DB is not shadowed by the data volume) is unchanged in shape — only the file name changes.

## Impact

- **Code**: `backend/Dockerfile`, `backend/docker-entrypoint.sh`.
- **Specs**: `openspec/specs/container-deployment/spec.md` (delta).
- **Build**: `docker build -t forkcast-backend ./backend` will succeed again; CI workflow on `main` will publish a working image.
- **Runtime**: existing `forkcast_data` volumes that still contain a stale `bls.json` will keep that file (untouched by the new entrypoint) but it will no longer be read; harmless. New `foods.json` will be refreshed in the volume on every container start, so image updates ship updated curated data.
- **Risk**: low. Pure plumbing fix; the application layer already reads `foods.json`.
