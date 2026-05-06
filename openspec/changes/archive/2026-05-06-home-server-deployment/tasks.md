## 1. Backend Dockerfile

- [x] 1.1 Create `backend/Dockerfile` with Node 22 Alpine base, pnpm install (production only), copy `src/` and `data/bls.json`, expose port 3000, set CMD to run with `--experimental-transform-types`
- [x] 1.2 Create `backend/.dockerignore` excluding `node_modules`, `data/log-entries.json`, `data/recipes.json`, test files
- [x] 1.3 Verify `docker build -f backend/Dockerfile -t forkcast-backend .` succeeds and container starts on port 3000

## 2. Frontend Dockerfile and nginx config

- [x] 2.1 Create `frontend/nginx.conf` with static file serving, SPA fallback (`try_files $uri /index.html`), and `/api` reverse proxy to `http://backend:3000`
- [x] 2.2 Create `frontend/Dockerfile` with multi-stage build: Node 22 Alpine build stage runs `pnpm build`, nginx:alpine serve stage copies `dist/` and `nginx.conf`
- [x] 2.3 Create root `.dockerignore` excluding `node_modules`, `dist`, openspec, CSV files
- [x] 2.4 Verify `docker build -f frontend/Dockerfile -t forkcast-frontend .` succeeds and container serves the app on port 80

## 3. Docker Compose

- [x] 3.1 Create `docker-compose.yml` at repo root with `backend` service (image from Docker Hub, volume `forkcast_data:/app/backend/data`, internal network), `frontend` service (image from Docker Hub, port `80:80`, depends on backend), and named volume declaration
- [x] 3.2 Verify full stack starts and app is accessible (verified with docker run on shared network)
- [x] 3.3 Verify backend data persists: set nutrition goal, restart the backend container, confirm the data is still there

## 4. GitHub Actions CI

- [x] 4.1 Create `.github/workflows/deploy.yml` mirroring tizzydotdev's `main.yml`: trigger on push to `main` and `workflow_dispatch`, checkout, Docker Buildx setup, Docker Hub login using `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` secrets, build and push `backend` image tagged `${{ secrets.DOCKERHUB_USERNAME }}/forkcast-backend:latest`
- [x] 4.2 Extend the same workflow job (or add a second job) to build and push the `frontend` image tagged `${{ secrets.DOCKERHUB_USERNAME }}/forkcast-frontend:latest`
- [x] 4.3 Verify the workflow runs successfully and images appear on Docker Hub
