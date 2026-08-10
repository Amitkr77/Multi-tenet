ARG NODE_VERSION=22

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build
#   • Full install (dev deps needed for nest build + prisma generate).
#   • Native-addon build tools for argon2 (node-gyp: python3 + make + g++).
#   • openssl for Prisma's query-engine at generate time.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /repo

# Enable pnpm via corepack (ships with Node 22, just needs activation).
RUN corepack enable

# Native-addon and Prisma build requirements.
RUN apk add --no-cache python3 make g++ openssl

# ── Workspace manifests (layer-cached; only invalidated when a package.json
#    or the lockfile changes, not on every source edit) ──────────────────────
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# packages/ — only manifests + the config package's actual files (it ships
# raw JS/JSON configs, no build step, so the full dir is needed now).
COPY packages/config/           packages/config/
COPY packages/database/package.json  packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json   packages/ui/package.json

# api manifest
COPY apps/api/package.json      apps/api/package.json

# Install everything (postinstall: prisma generate, argon2 native compile).
RUN pnpm install --frozen-lockfile

# ── Source ──────────────────────────────────────────────────────────────────
COPY packages/database/  packages/database/
COPY packages/shared-types/ packages/shared-types/
COPY apps/api/           apps/api/

# Build shared workspace packages that api depends on, then api itself.
RUN pnpm --filter @saas/database    build
RUN pnpm --filter @saas/shared-types build
RUN pnpm --filter @saas/api         build

# Prune to production dependencies only (workspace symlinks are resolved and
# bundled into the deploy dir — no monorepo tooling needed in the runner).
RUN pnpm --filter @saas/api --prod deploy /deploy/api

# dist/ is .gitignore-d so pnpm deploy does not copy it — add it manually.
RUN cp -r apps/api/dist /deploy/api/dist

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runner (minimal image, no build tools)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

# Prisma's query-engine binary links against libssl at runtime.
RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY --from=builder /deploy/api ./

EXPOSE 3001

CMD ["node", "dist/main"]
