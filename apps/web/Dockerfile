# syntax=docker/dockerfile:1
# Web image: the built SPA served by Caddy, which also terminates TLS and proxies /api and /v1 to
# the API, so the browser only ever talks to one origin. Build from the repo root:
#   docker build -f apps/web/Dockerfile .

FROM node:24-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install -g pnpm@11.25.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter @documento/web...
# The web type-checks against the API's router types, so the API sources come along.
COPY packages packages
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/
COPY apps/web apps/web
RUN pnpm --filter @documento/web build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
EXPOSE 80 443
