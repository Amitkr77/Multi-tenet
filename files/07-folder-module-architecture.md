# Folder / Module Architecture

## Multi-Tenant SaaS Commerce Platform

---

## 1. Repository Layout (Turborepo Monorepo)

```
saas-platform/
├── apps/
│   ├── web/                     # Next.js — landing, auth, dashboard, storefront
│   ├── api/                     # NestJS modular monolith
│   └── worker/                  # BullMQ job processor (own package, no dependency on apps/api)
├── packages/
│   ├── shared-types/            # Zod schemas & DTOs shared between web and api
│   ├── ui/                      # Shared React components/design tokens
│   ├── config/                  # Shared ESLint/TS/Tailwind config
│   └── database/                # Prisma schema/migrations/client + the tenant-scoping extension — see §5
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   └── Dockerfile.web
├── .github/
│   └── workflows/                # CI/CD pipelines
├── docker-compose.yml            # Postgres, Redis, MinIO, Mailhog — local dev only
├── turbo.json
└── package.json
```

**Realized deviation (Phase 1 build):** `schema.prisma`/`migrations/` live in `packages/database/prisma/`, not a root-level `prisma/` — see §5 for why.

---

## 2. Backend (`apps/api`) — NestJS Module Structure

```
apps/api/src/
├── main.ts
├── app.module.ts
│
├── common/
│   ├── decorators/
│   │   ├── current-tenant.decorator.ts
│   │   ├── current-user.decorator.ts
│   │   └── permissions.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── rbac.guard.ts
│   │   ├── tenant-resolver.guard.ts
│   │   └── plan-limit.guard.ts
│   ├── interceptors/
│   │   ├── tenant-context.interceptor.ts   # sets RLS session var + AsyncLocalStorage context
│   │   └── logging.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── pipes/
│   │   └── zod-validation.pipe.ts
│   ├── permissions/
│   │   └── granted-permissions.ts   # shared by RbacGuard and AuthService#buildMeResponse — one place resolves a user's roles/codes for a tenant context
│   └── utils/
│
├── config/
│   ├── configuration.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── stripe.config.ts
│
├── prisma/
│   ├── prisma.module.ts
│   ├── prisma.service.ts        # wraps @saas/database's tenant-scoped client with nestjs-cls-sourced context; exposes `.base` + `.runScoped()` for the bootstrap-exception call sites (register, login, refresh, verify-email, reset-password)
│   └── tenant-context.ts        # CLS keys
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── sessions.service.ts       # SESSION rows — per-device revoke + logout-all
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── google.strategy.ts
│   │   └── dto/
│   │
│   ├── tenants/
│   │   ├── tenants.module.ts
│   │   ├── tenants.controller.ts
│   │   ├── tenants.service.ts
│   │   ├── super-admin.controller.ts
│   │   ├── impersonation.service.ts  # short-lived scoped token + AUDIT_LOG write
│   │   └── dto/
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   │
│   ├── roles/
│   │   ├── roles.module.ts
│   │   ├── roles.controller.ts
│   │   ├── roles.service.ts
│   │   ├── permissions.constants.ts
│   │   └── dto/
│   │
│   ├── products/
│   │   ├── products.module.ts
│   │   ├── products.controller.ts
│   │   ├── products.service.ts
│   │   ├── categories/
│   │   ├── brands/
│   │   ├── attributes/
│   │   ├── variants/
│   │   └── dto/
│   │
│   ├── inventory/
│   │   ├── inventory.module.ts
│   │   ├── inventory.controller.ts
│   │   ├── inventory.service.ts
│   │   └── dto/
│   │
│   ├── customers/
│   │   ├── customers.module.ts
│   │   ├── customers.controller.ts
│   │   ├── customers.service.ts
│   │   └── dto/
│   │
│   ├── cart/
│   │   ├── cart.module.ts
│   │   ├── cart.controller.ts
│   │   ├── cart.service.ts
│   │   └── dto/
│   │
│   ├── orders/
│   │   ├── orders.module.ts
│   │   ├── orders.controller.ts
│   │   ├── orders.service.ts
│   │   ├── checkout.service.ts
│   │   └── dto/
│   │
│   ├── payments/
│   │   ├── payments.module.ts
│   │   ├── payments.controller.ts
│   │   ├── stripe-connect.service.ts
│   │   ├── stripe-billing.service.ts
│   │   ├── webhooks.controller.ts
│   │   └── dto/
│   │
│   ├── coupons/
│   │   ├── coupons.module.ts
│   │   ├── coupons.controller.ts
│   │   ├── coupons.service.ts
│   │   └── dto/
│   │
│   ├── shipping/
│   │   ├── shipping.module.ts
│   │   ├── shipping.controller.ts
│   │   ├── shipping.service.ts
│   │   └── dto/
│   │
│   ├── tax/
│   │   ├── tax.module.ts
│   │   ├── tax.controller.ts
│   │   ├── tax.service.ts
│   │   └── dto/
│   │
│   ├── reviews/
│   │   ├── reviews.module.ts
│   │   ├── reviews.controller.ts
│   │   ├── reviews.service.ts
│   │   └── dto/
│   │
│   ├── analytics/
│   │   ├── analytics.module.ts
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   └── dto/
│   │
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.controller.ts
│   │   ├── notifications.service.ts
│   │   └── dto/
│   │
│   ├── subscriptions/
│   │   ├── subscriptions.module.ts
│   │   ├── subscriptions.controller.ts
│   │   ├── subscriptions.service.ts
│   │   ├── plan-limits.service.ts
│   │   ├── plan-override.service.ts  # TENANT_PLAN_OVERRIDE — temporary/manual overrides, checked before plan_limits
│   │   └── dto/
│   │
│   ├── billing/
│   │   ├── billing.module.ts
│   │   ├── billing.controller.ts
│   │   ├── billing.service.ts
│   │   └── dto/
│   │
│   ├── domains/
│   │   ├── domains.module.ts
│   │   ├── domains.controller.ts
│   │   ├── domains.service.ts
│   │   ├── dns-verification.service.ts
│   │   ├── acm.service.ts
│   │   └── dto/
│   │
│   └── audit-log/
│       ├── audit-log.module.ts
│       ├── audit-log.service.ts
│       └── audit-log.interceptor.ts
│
└── test/
    ├── unit/
    ├── integration/
    └── tenant-isolation/           # required CI gate — cross-tenant leakage tests
```

---

## 3. Background Worker (`apps/worker`)

```
apps/worker/src/
├── main.ts
├── worker.module.ts
├── processors/
│   ├── email.processor.ts
│   ├── invoice.processor.ts
│   ├── image.processor.ts
│   ├── usage-reconciliation.processor.ts
│   └── webhook-retry.processor.ts
└── queues/
    └── queue.constants.ts
```

**Realized deviation (Phase 1 build):** the original plan for this section described the worker sharing Prisma/module logic with `apps/api` "via internal package resolution" — i.e. depending on `apps/api` directly. Built instead as: shared Prisma client + tenant-scoping extension live in `packages/database` (see §1), imported by both `apps/api` and `apps/worker` as an ordinary workspace package. Apps depending on other apps is a monorepo smell; packages are the intended sharing unit. No duplicated logic between API and worker either way — just via a proper package boundary instead of a direct app-to-app dependency.

---

## 4. Frontend (`apps/web`) — Next.js Structure

```
apps/web/
├── app/
│   ├── (marketing)/              # Landing website
│   │   └── page.tsx
│   ├── (auth)/                   # Login, register, password reset
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (dashboard)/               # Tenant dashboard — behind auth
│   │   ├── layout.tsx
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── coupons/
│   │   ├── analytics/
│   │   ├── settings/
│   │   │   ├── team/
│   │   │   ├── billing/
│   │   │   ├── domains/
│   │   │   └── payments/
│   │   └── audit-log/
│   ├── (storefront)/[subdomain]/  # Public tenant storefronts
│   │   ├── page.tsx
│   │   ├── products/[slug]/
│   │   ├── cart/
│   │   └── checkout/
│   └── (platform-admin)/          # Super Admin console
│       ├── tenants/
│       ├── plans/
│       └── analytics/
│
├── components/
│   ├── ui/                        # Shared design system components
│   ├── forms/
│   └── charts/
│
├── lib/
│   ├── api-client.ts               # fetch wrapper: attaches access token, silent-refreshes once on 401, normalizes errors to ApiError
│   ├── auth.ts                     # access-token storage (module var + sessionStorage mirror — see file comment on why not the refresh token too)
│   ├── query-provider.tsx          # QueryClientProvider wrapper for the root layout
│   └── hooks.ts                    # TanStack Query hooks: useLogin/useRegister/useLogout/useMe/etc. — realized as one file, not a hooks/ directory, at Phase 1's size
│
└── proxy.ts                         # Next.js 16 renamed "middleware.ts" → "proxy.ts"; deliberately near-empty — see its file comment for why subdomain resolution isn't here yet (the refresh cookie lives on the API's own origin, not this app's, so today's auth gate is client-side in app/dashboard/layout.tsx instead)
```

**Realized deviation:** `(dashboard)` is a real `dashboard/` route segment, not a route group — a route group adds no URL segment, which collided with `(marketing)`'s `page.tsx` both resolving to `/`. `apps/web/lib/tenant-context.ts` wasn't needed in Phase 1 (no subdomain routing yet in the frontend); `@CurrentTenantId()`'s backend equivalent lives in `apps/api/src/common/decorators/current-tenant.decorator.ts` instead.

---

## 5. Design Principles

- Each backend module is self-contained: its own controller, service, DTOs, and (where needed) sub-resources — no cross-module direct DB access; modules communicate via injected services.
- `common/guards/tenant-resolver.guard.ts` resolves `tenant_id` from the `Host` header (or a `NODE_ENV !== 'production'`-gated `X-Tenant-Subdomain` dev header) before any module logic runs. `common/interceptors/tenant-context.interceptor.ts` then publishes that (plus the authenticated user id) onto CLS (`nestjs-cls`), which is what `packages/database`'s tenant-scoping extension reads at query time to decide the `SET LOCAL app.tenant_id` for that request's Prisma calls — this is the literal wiring behind arch.md §4/§16's "one code path covers both isolation and observability."
- `packages/database` (not `apps/api/src/prisma`) owns `schema.prisma`, migrations (including the hand-written RLS-enabling migration), the base Prisma client factory, and the tenant-scoping `$extends` wrapper — the one piece both `apps/api` and `apps/worker` need identically. `apps/api/src/prisma/prisma.service.ts` is a thin per-app wrapper: it supplies the CLS-backed `getTenantId()` closure and exposes `.base` (unscoped) + `.runScoped(tenantId, fn)` for the handful of call sites that must pick their own tenant scope instead of inheriting request context (tenant registration, login, refresh, verify-email, reset-password — each documented inline as a deliberate bootstrap exception to the generic per-request pattern).
- `plan-limit.guard.ts` is applied selectively to endpoints that create billable resources (products, staff invites, orders) to enforce Section 7 of the NFR/FR docs. Scaffolded (always-allow) in Phase 1; enforcement is Phase 5 work once `usage_counters`/`plan_limits` exist.
- `packages/shared-types` is the single source of truth for request/response shapes — both `apps/web` and `apps/api` import from it, preventing frontend/backend drift.
- The `worker` app is intentionally structured as an independent deployable process from day one, depending only on `packages/database` and `packages/shared-types` (never on `apps/api`) — this is the natural extraction point if any specific job type needs to scale independently later.
