FROM node:26-alpine AS build

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/

# --ignore-scripts: the root `prepare` (`vp config`) installs git hooks and fails without
# git; no dependency needs an install script.
RUN pnpm install --filter @forkcast/frontend --frozen-lockfile --ignore-scripts

COPY frontend/ ./frontend/

WORKDIR /app/frontend

RUN pnpm build

FROM nginx:alpine

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
