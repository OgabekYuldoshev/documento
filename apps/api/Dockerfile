# syntax=docker/dockerfile:1
# API image. Build from the repo root:  docker build -f apps/api/Dockerfile .
# The workspace packages are source-exported TypeScript, so the API runs through tsx (no build step).

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install -g pnpm@11.25.0

# ---- production dependencies only (manifests first: this layer caches until they change) ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts --filter @documento/api...

# ---- Typst binary, pinned (the version the render tests run against) ----
FROM debian:bookworm-slim AS typst
ARG TYPST_VERSION=0.15.1
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
    && apt-get clean
RUN case "$TARGETARCH" in \
      amd64) arch=x86_64 ;; \
      arm64) arch=aarch64 ;; \
      *) echo "unsupported arch: $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${arch}-unknown-linux-musl.tar.xz" \
       | tar -xJ -C /usr/local/bin --strip-components=1 "typst-${arch}-unknown-linux-musl/typst" \
    && typst --version

# ---- runtime ----
FROM node:24-bookworm-slim AS runtime
# Typst runs with --ignore-system-fonts and reads only FONTS_DIR, so the fonts are copied there.
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-inter fonts-roboto fonts-liberation fonts-noto-core \
    && mkdir /fonts \
    && cp -r /usr/share/fonts/. /fonts/ \
    && apt-get clean
COPY --from=typst /usr/local/bin/typst /usr/local/bin/typst

ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_URL=file:/data/app.db \
    STORAGE_DIR=/data/storage \
    TYPST_BIN=/usr/local/bin/typst \
    FONTS_DIR=/fonts

WORKDIR /app
COPY --from=deps --chown=node:node /app/ ./
COPY --chown=node:node packages/shared/ packages/shared/
COPY --chown=node:node packages/typescript-config/ packages/typescript-config/
COPY --chown=node:node apps/api/tsconfig.json apps/api/
COPY --chown=node:node apps/api/src apps/api/src
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/apps/api
VOLUME /data
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
