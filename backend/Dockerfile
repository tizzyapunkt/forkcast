FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/

RUN pnpm install --filter @forkcast/backend --frozen-lockfile --prod --ignore-scripts

COPY backend/src ./backend/src
# The starting-point catalog lives outside the data volume; the app installs it into
# the volume only when no catalog is there yet, so a deploy never overwrites edits.
COPY backend/data/catalog.json ./backend/catalog.seed.json
COPY backend/docker-entrypoint.sh ./backend/docker-entrypoint.sh
RUN chmod +x ./backend/docker-entrypoint.sh

WORKDIR /app/backend

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "--experimental-transform-types", "src/index.ts"]
