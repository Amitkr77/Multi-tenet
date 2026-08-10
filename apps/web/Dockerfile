ARG NODE_VERSION=22

# NEXT_PUBLIC_API_URL is baked into the JS bundle at build time by Next.js
# (any NEXT_PUBLIC_ var must be known when `next build` runs, not at runtime).
# Override with --build-arg NEXT_PUBLIC_API_URL=https://api.yourapp.com/api/v1
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /repo

RUN corepack enable

# @saas/ui has a peer dep on React — no native addons, so no apk build deps.
# Sharp (Next.js image optimisation) compiles a native binding; include build
# tools so the optional sharp install succeeds.
RUN apk add --no-cache python3 make g++

# Workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/               packages/config/
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json       packages/ui/package.json
COPY apps/web/package.json          apps/web/package.json

RUN pnpm install --frozen-lockfile

# Source
COPY packages/shared-types/ packages/shared-types/
COPY packages/ui/           packages/ui/
COPY apps/web/              apps/web/

# Build shared packages web depends on.
RUN pnpm --filter @saas/shared-types build
RUN pnpm --filter @saas/ui           build

# Build Next.js (output: 'standalone' in next.config.ts creates
# .next/standalone — a self-contained server with only the modules it uses).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN pnpm --filter @saas/web build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runner
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# PORT can be overridden by orchestration (e.g. ECS task definition).
ENV PORT=3000
# HOSTNAME must be 0.0.0.0 so the standalone server binds to all interfaces
# (default 127.0.0.1 makes it unreachable from outside the container).
ENV HOSTNAME=0.0.0.0

# standalone/ contains a minimal server.js + only the node_modules it needs.
COPY --from=builder /repo/apps/web/.next/standalone/ ./

# Static assets are NOT included in standalone — copy them into the expected
# paths so Next.js serves them correctly.
COPY --from=builder /repo/apps/web/.next/static/ .next/static/
COPY --from=builder /repo/apps/web/public/        public/

EXPOSE 3000

# next.config.ts output:'standalone' generates apps/web/server.js at the
# monorepo-relative path — standalone bundles it to the root of the output.
CMD ["node", "server.js"]
