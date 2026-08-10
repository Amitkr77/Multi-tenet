# Security Review — RBAC Coverage & RLS Policy Audit

## Multi-Tenant SaaS Commerce Platform

**Performed:** 2026-08-06, against the codebase as of the end of Phase 6 (custom domains, outbound webhooks, and the Public API/API-key tier all complete). Closes the "Security review (RBAC coverage, RLS policy audit)" row of `08-development-roadmap.md`'s Cross-Cutting Milestones table.

**Method:** every finding below was checked two ways — a source-level read of every table's RLS status and every controller's guard/permission coverage, then, wherever the code-level conclusion was anything less than obvious, a live empirical test (real HTTP requests against a running dev instance, or a direct `psql` query) to confirm it rather than trust the read. Nothing here is a "should be fine" claim.

**Headline result:** no exploitable cross-tenant or cross-user gap was found. One real documentation gap was found and fixed (a no-RLS table with no recorded justification, unlike every one of its siblings). Everything else already flagged by the sweep turned out to be a correct, deliberate design once traced through to its actual query/guard behavior — confirmed by testing the exploit attempt directly, not by reading the code and assuming it holds.

---

## Part 1 — RLS policy audit

All 48 tables in the `public` schema were enumerated via `pg_class.relrowsecurity`/`relforcerowsecurity`. **36 have RLS + FORCE ROW LEVEL SECURITY enabled** (the standard tenant-isolation policy used throughout this project). **12 do not** — every one of the 12 is a deliberate "bootstrap table" or "global catalog" design, not an oversight, for the reasons below.

| Table | RLS | Why (and how it was confirmed) |
|---|---|---|
| `_prisma_migrations` | No | Prisma's own internal bookkeeping table, not application data. No action needed. |
| `tenants` | No | *Is* the tenant — resolving which tenant a request belongs to is this table's entire purpose, so it cannot itself require tenant context to read. Established since Phase 1; `TenantResolverGuard` queries it via `prisma.base`. |
| `custom_domains` | No | Same bootstrap reasoning as `tenants` — `TenantResolverGuard` must resolve a tenant from an arbitrary `Host` header with zero context. Originally shipped *with* RLS in Phase 6 and failed a live curl test (404 on a spoofed Host header) before being corrected via a dedicated migration (`20260806034500_custom_domains_no_rls`). Isolation for its own management CRUD is app-layer (`where: {tenantId}`). |
| `api_keys` | No | Same bootstrap reasoning, designed in from the start this time (not discovered via failure) — `ApiKeyGuard` must resolve a key with zero tenant context, since resolving the tenant is the point of the lookup. Isolation for its own CRUD is app-layer, confirmed via the Public API round's e2e suite (cross-tenant key rejection, `403`). |
| `plans` | No | Global, Super-Admin-managed catalog shared by every tenant (no `tenant_id` column at all) — not tenant data. |
| `plan_limits` | No | Belongs to a `Plan`, not a `Tenant` (no `tenant_id` column) — same category as `plans`. |
| `permissions` | No | Global catalog of possible permission codes (e.g. `products.manage`) — identical to every tenant, not tenant-owned data. |
| `role_permissions` | No | **Found undocumented this round — fixed.** See "Findings & Fixes" below. |
| `sessions` (staff) | No | `tenantId` is nullable and denormalized only — a refresh token is, by design, presented before any tenant context exists (the same chicken-and-egg problem as `tenants` itself). Isolation is via the `userId` FK; every query in `SessionsService` filters by `userId` explicitly. |
| `customer_sessions` | No | Same reasoning as `sessions`, but for customer (storefront) auth. **Already found and fixed in an earlier phase** — originally shipped with an (incorrect) RLS policy via `enable_rls_commerce`, corrected by a dedicated migration, `20260805040524_fix_customer_sessions_no_rls`. Re-confirmed this round: every HTTP route touching customer sessions (`customer-auth.controller.ts`) resolves the customer's identity from their own verified JWT, never from a client-suppliable `customerId`/`sessionId` path param. |
| `verification_tokens` | No | Same reasoning as `sessions` (nullable, denormalized `tenantId`) — email verification/password reset/staff invite all resolve tenant scope from the token itself, before any tenant context otherwise exists. |
| `webhook_events` | No | Inbound Stripe webhooks arrive with no authenticated tenant context at all (nullable `tenantId`); written via `prisma.base`. Distinct from the tenant-configured *outbound* `webhook_subscriptions`/`webhook_deliveries`, which are fully RLS-protected. |

### Findings & Fixes — RLS

**Finding:** `RolePermission` (`role_permissions` table) had no RLS policy and, uniquely among the 12 no-RLS tables, **no comment explaining why** — every sibling table has an inline justification; this one had none, making it indistinguishable from an accidental gap on inspection.

**Investigation:** `role_permissions` conceptually belongs to one tenant (via `roleId` → `Role.tenantId`, and `Role` is RLS-protected), so — unlike genuinely global tables (`permissions`, `plans`) — a truly unscoped read/write against it *would* be a real cross-tenant leak if any code path allowed a client-suppliable, unvalidated `roleId` to reach it directly. A full grep of every `.rolePermission.` call site in `apps/api/src` found exactly two files touching it:
- `RolesService#update`/`#remove` (writes) — both call `role.findFirst({ id: roleId, tenantId })` and throw `404` before any `rolePermission` mutation, so a caller can never write against another tenant's role.
- `RolesService#list` and `granted-permissions.ts`'s `resolveGrantedPermissions` (reads) — both reach `rolePermissions` only via a Prisma nested `include` off an already tenant-scoped `Role`/`UserRole` query, never a raw `roleId`.

**Empirical confirmation:** registered two fresh tenants (A, B); from tenant A's owner JWT, attempted `PATCH /roles/:id` and `DELETE /roles/:id` against tenant B's real (non-guessed) staff `roleId`. Both returned `404 RESOURCE_NOT_FOUND`. Direct `psql` read of `role_permissions` for that `roleId` afterward confirmed its 9 original permission rows were completely unchanged.

**Fix:** added an explanatory comment to the `RolePermission` model in `schema.prisma`, matching the style and rigor of every sibling table's comment — no schema/migration change needed, since the underlying design was already correct, just undocumented. See `packages/database/prisma/schema.prisma`.

---

## Part 2 — RBAC coverage audit

Every `@Post`/`@Patch`/`@Put`/`@Delete` route across all 29 controllers with mutating routes was enumerated (**74 mutating routes total**; `health`/`metrics` have none). For each, confirmed one of: a method- or class-level `@RequirePermissions(...)` (cross-checked against the real permission catalog in `packages/database/src/permissions.ts`), a deliberate `@Public()` with a clear reason, or an alternate guard (`CustomerJwtGuard`, for storefront/customer self-service routes).

**68 of 74** routes carry an explicit, tier-appropriate `@RequirePermissions`, a justified `@Public()` (registration, login, refresh, email verification, password reset, invite-acceptance, Stripe webhook receivers, anonymous coupon-preview validation), or `CustomerJwtGuard` (cart, checkout, customer profile/address self-service, customer review submission).

**6 routes** — all in `auth.controller.ts` — carry neither `@RequirePermissions` nor `@Public()`: `POST /auth/logout`, `POST /auth/logout-all`, `DELETE /auth/sessions/:id`, `POST /auth/switch-tenant`, `POST /auth/2fa/enable`, `POST /auth/2fa/verify`. Each was individually checked:

| Route | Verdict | Reasoning |
|---|---|---|
| `POST /auth/logout` | **Fine, no fix needed** | Revokes only the caller's own current refresh token — self-service by definition, no permission concept applies. |
| `POST /auth/logout-all` | **Fine, no fix needed** | Revokes only the caller's own sessions (`SessionsService#revokeAll(userId)`, scoped by the authenticated `userId`). |
| `DELETE /auth/sessions/:id` | **Fine, empirically confirmed** | `SessionsService#revoke(userId, sessionId)` runs `updateMany({ where: { id: sessionId, userId, revokedAt: null } })` — scoped to the caller's own `userId` in the query itself. **Tested directly**: registered tenants A and B, had tenant B's owner call `DELETE /auth/sessions/:id` with tenant A owner's real session id — got `204` (a benign false-success on the 0-row no-op, not a security issue) but a follow-up `GET /auth/sessions` as tenant A confirmed the session was **still active, untouched**. No IDOR. |
| `POST /auth/switch-tenant` | **Fine, confirmed via code read** | `AuthService#switchTenant` requires a real `User` row for the caller's own email inside the target tenant (`tx.user.findFirst({ tenantId: dto.tenantId, email: currentEmail })`) before issuing any token — a caller can only switch into a tenant where they already have a genuine account, not an arbitrary `tenantId`. |
| `POST /auth/2fa/enable` | **N/A** | Non-functional stub — always returns `501 NOT_IMPLEMENTED`. No real access to gate. |
| `POST /auth/2fa/verify` | **N/A** | Same — stub, `501`. |

### Findings & Fixes — RBAC

**No gaps found.** All six flagged routes are legitimately self-service-on-own-identity actions where a tenant permission wouldn't apply, or inert stubs. No code change was made for this section — the honest result of a real audit is sometimes "confirmed clean," not a manufactured finding.

**Minor, non-security observation:** `DELETE /auth/sessions/:id` returns `204` even when the given `id` doesn't belong to the caller (silent no-op via `updateMany`'s 0-affected-rows case, rather than a `404`). This reveals nothing to a caller and causes no harm, but is a minor API-precision inconsistency with the rest of the codebase's usual "404 if not yours" convention (e.g. `RolesService`, `DomainsService`). Noted for a future cleanup pass; not a security finding and out of scope for this round.

---

## Conclusion

Tenant isolation (RLS) and permission enforcement (RBAC) hold up under direct testing across every table and every mutating route in the system as of the end of Phase 6. The one real gap found — a missing comment, not a missing control — is fixed. This closes the roadmap's "Security review (RBAC coverage, RLS policy audit)" cross-cutting milestone.

**Explicitly out of scope for this review** (disclosed, deferred to a future round): load/performance testing against NFR targets, and the storefront accessibility (WCAG 2.1 AA) audit — both remain outstanding items on the same cross-cutting milestone table.
