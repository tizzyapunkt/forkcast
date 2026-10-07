# forkcast

A personal meal planning and nutrition tracking PWA — built because existing apps (fddb, yazio, myfitnesspal) make advance meal planning too tedious.

## The Problem

Calorie and macro tracking apps exist, but planning meals a week ahead while hitting specific nutrition goals is clunky in all of them. forkcast is built around that planning-first workflow.

## Core Idea

- Plan meals up to a week in advance
- Track calories and macros against personal goals (user-defined, no fixed diet approach)
- Manage recipes and ingredients
- Generate grocery lists from the weekly plan
- Minimal friction — every interaction should be fast and obvious

## Context

Built for someone with a full-time job, a young family, and serious fitness goals — meaning low time, high standards. Mobile-first PWA so it works on the go (grocery store, meal prep), full desktop support too.

Built for personal use first; designed with future product potential in mind.

## Architecture

### Domain-Driven Design
Pragmatic DDD — the domain model uses the language of nutrition and meal planning (`MealPlan`, `Recipe`, `NutritionGoal`, etc.), organized into bounded contexts. Aggregates and value objects used where they genuinely add clarity, skipped where they don't. Modularization over ceremony.

### Hexagonal Architecture
Domain logic is framework-agnostic and infrastructure-free. Ports define what the domain needs; adapters wire in the database, HTTP layer, and any external services. Nothing flows inward — infrastructure depends on the domain, not the other way around.

### CQRS
Commands express business intent (`PlanMeal`, `AddRecipe`); queries are purpose-built for the UI. Separation of concerns is the goal, not performance optimization. No Event Sourcing.

### API Design
The API speaks the domain language — operations describe business intent (`/plan-meal`, `/add-to-grocery-list`), not database operations.

### Build only what's needed
No speculative infrastructure or abstractions. Things get added when there's a concrete reason.

**Current baseline:** JSON files for persistence, no database. Upgraded when the need arises.

## Data

The food catalog is a single runtime-writable store at `backend/data/catalog.json`, editable from inside the app (Einstellungen → Katalog verwalten): entries can be created, corrected, and deleted, and confirming an unmatched ingredient during a photo import writes straight into it.

The tracked `backend/data/catalog.json` doubles as the starting point shipped in the backend image. On boot the backend installs it into the data directory **only when no catalog is there yet** — an existing catalog is never overwritten, so a deploy cannot destroy edits. Settings offers a snapshot download (a copy; it does not drain the catalog) that can be committed back as the repo's starting point.

## AI recipe import

Recipes can be imported from one or more photos of a single recipe (a printed page, an Instagram screenshot carousel, front + back of a recipe card). The backend forwards the images to Claude vision in a single call, matches each extracted ingredient against the existing catalog, and returns a draft for user review — no recipe is persisted until the user confirms. Configure on the server via `ANTHROPIC_API_KEY` (required), `ANTHROPIC_MODEL` (optional, defaults to a current Claude Sonnet vision model), and the optional caps `RECIPE_IMPORT_MAX_IMAGE_BYTES` (5 MB), `RECIPE_IMPORT_MAX_TOTAL_BYTES` (20 MB), `RECIPE_IMPORT_MAX_IMAGES` (8). Without `ANTHROPIC_API_KEY` the endpoint returns `503 ai-import-not-configured` and the frontend hides the import entry — the rest of the app keeps working.

## Self-hosting

forkcast runs as two public container images on Docker Hub, built from `main`: [`tizzyapunkt/forkcast-backend`](https://hub.docker.com/r/tizzyapunkt/forkcast-backend) (API, data in a volume) and [`tizzyapunkt/forkcast-frontend`](https://hub.docker.com/r/tizzyapunkt/forkcast-frontend) (nginx serving the app and proxying `/api` to the backend). Neither image contains secrets or personal data; the only data shipped is the starting food catalog. Images are `linux/amd64` only for now.

It is built for **one person**: a single password, no sign-up, no sharing.

```bash
mkdir forkcast && cd forkcast
curl -LO https://raw.githubusercontent.com/tizzyapunkt/forkcast/main/docker-compose.yml
echo "AUTH_PASSWORD=choose-a-password" > .env
echo "AUTH_JWT_SECRET=$(openssl rand -hex 32)" >> .env
docker compose up -d
```

Then open `http://<host>:8080` and log in with the password. [`docker-compose.yml`](docker-compose.yml) runs both images with one data volume; [`backend/.env.example`](backend/.env.example) lists every setting, e.g. `ANTHROPIC_API_KEY` for photo import and packaging capture.

**HTTPS:** installing the app to the home screen and the barcode scanner need a secure context, so put forkcast behind a reverse proxy with TLS (Caddy, Traefik, nginx, your NAS's built-in one) for anything beyond `localhost`.

**Updates:** `docker compose pull && docker compose up -d`. The data volume is kept, and an existing food catalog is never overwritten.

**Backups:** everything (log, recipes, goals, weight, catalog) lives in the `forkcast_data` volume as JSON files, so back up the volume. Settings also offers a download of the food catalog alone.

## License

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only). Use it, fork it, run it for yourself. If you run a modified version as a service for others, you have to publish its source under the same license and keep the copyright and license notices, including the one in the app's settings.
