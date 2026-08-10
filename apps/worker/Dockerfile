ARG NODE_VERSION=22

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /repo

RUN corepack enable
RUN apk add --no-cache python3 make g++ openssl

# Workspace manifests (layer-cache friendly)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/                packages/config/
COPY packages/database/package.json  packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json        packages/ui/package.json
COPY apps/worker/package.json        apps/worker/package.json

RUN pnpm install --frozen-lockfile

# Source
COPY packages/database/    packages/database/
COPY packages/shared-types/ packages/shared-types/
COPY apps/worker/          apps/worker/

RUN pnpm --filter @saas/database     build
RUN pnpm --filter @saas/shared-types build
RUN pnpm --filter @saas/worker       build

RUN pnpm --filter @saas/worker --prod deploy /deploy/worker
RUN cp -r apps/worker/dist /deploy/worker/dist

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runner
# No HTTP port — this process only consumes BullMQ queues.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY --from=builder /deploy/worker ./

CMD ["node", "dist/main"]
