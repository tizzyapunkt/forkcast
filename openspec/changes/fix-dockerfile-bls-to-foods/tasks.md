## 1. Update backend container plumbing

- [ ] 1.1 In `backend/Dockerfile`, replace the `COPY backend/data/bls.json ./backend/bls.json.img` line and its comment with `COPY backend/data/foods.json ./backend/foods.json.img`, updating the comment to reference foods (kept outside the data volume so the entrypoint can refresh it on each start)
- [ ] 1.2 In `backend/docker-entrypoint.sh`, replace the `cp /app/backend/bls.json.img /app/backend/data/bls.json` line with `cp /app/backend/foods.json.img /app/backend/data/foods.json`

## 2. Verify the image builds and starts

- [ ] 2.1 Run `docker build -t forkcast-backend ./backend` from the repo root and confirm it completes without referencing `bls.json`
- [ ] 2.2 Run the built image with a fresh empty volume mounted at `/app/backend/data` and confirm `/app/backend/data/foods.json` exists and matches the committed `backend/data/foods.json` byte-for-byte (e.g. `docker run --rm -v $(pwd)/_test_vol:/app/backend/data forkcast-backend sh -c 'cat /app/backend/data/foods.json | head -c 200'`)
- [ ] 2.3 Hit the running backend's ingredient-search endpoint with a known FOODS query (e.g. `mohre`) and confirm it returns FOODS results, proving the in-memory FOODS service loaded the volume's `foods.json`

## 3. Sanity-check unaffected surfaces

- [ ] 3.1 Confirm `docker-compose.yml` still mounts `forkcast_data:/app/backend/data` and needs no change
- [ ] 3.2 Confirm `.github/workflows/deploy.yml` (or whatever name the CI deploy workflow uses) does not reference `bls.json` and needs no change; if it does, update it to reference `foods.json`
- [ ] 3.3 Grep the repo for any remaining non-test references to `bls.json` outside `openspec/` and confirm only the deliberate legacy-handling test (`backend/src/http/ingredient-search/search-ingredients.handler.test.ts` — treats legacy `bls` source as unknown) remains

## 4. Update the spec

- [ ] 4.1 After the implementation lands and the change is archived, the `openspec/specs/container-deployment/spec.md` requirements covered by the delta will be updated by the archive step — no manual edit to the canonical spec file in this change
