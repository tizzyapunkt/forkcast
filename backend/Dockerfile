FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/

RUN pnpm install --filter @forkcast/backend --frozen-lockfile --prod --ignore-scripts

COPY backend/src ./backend/src
# bls.json is stored outside the data volume so the entrypoint can refresh it on each start
COPY backend/data/bls.json ./backend/bls.json.img
COPY backend/docker-entrypoint.sh ./backend/docker-entrypoint.sh
RUN chmod +x ./backend/docker-entrypoint.sh

WORKDIR /app/backend

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "--experimental-transform-types", "src/index.ts"]
