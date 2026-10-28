# syntax=docker/dockerfile:1
#
# The one image both Fly apps run (docs/spec/operations.md sections 2 and 3).
# Node 24 runs the server's TypeScript source natively, so the only build is
# the web SPA; the runtime stage carries the server and db sources, the SQL
# migrations, production dependencies and the built SPA.
#
#   docker build -t finders-eaters .
#   docker run --rm -e DATABASE_URL_DIRECT=... finders-eaters node apps/server/src/cli.ts release
#   docker run --rm -p 8080:8080 -e DATABASE_URL=... finders-eaters
#
# The KB artifact joins this image with the knowledge base ticket: CI builds it
# before `docker build` and a COPY here fails the build when it is missing.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# pnpm at the version pinned in package.json's packageManager.
RUN corepack enable
WORKDIR /app

# Full install and the SPA build.
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @finders-eaters/web build

# Production dependencies of the server and the workspace packages it imports.
FROM base AS prod-deps
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter '@finders-eaters/server...'

FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
# Workspace packages stay as source outside node_modules: Node strips types
# from .ts files only when they are not under node_modules.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=prod-deps /app/packages/db/node_modules ./packages/db/node_modules
COPY package.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/server/src ./apps/server/src
COPY packages/db/package.json ./packages/db/
COPY packages/db/src ./packages/db/src
COPY packages/db/migrations ./packages/db/migrations
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 8080
CMD ["node", "apps/server/src/main.ts"]
