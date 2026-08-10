# Multi-Tenant SaaS Platform — Architecture & Planning Document

## 1. Product Vision

Build a Shopify-like multi-tenant SaaS platform where each business (tenant) can:

- Register its own account
- Create its own online store
- Manage products, inventory, orders, customers, and staff
- Choose a subscription plan

One platform hosts many independent businesses, isolated from one another.

---

## 2. Technology Stack

### Frontend

- **Next.js** + **TypeScript** + **Tailwind CSS**
- **TanStack Query** (data fetching/caching)
- **React Hook Form** + **Zod** (forms & validation)

### Backend

- **NestJS** + **TypeScript** — modular architecture, dependency injection, enterprise-ready

### Database

- **PostgreSQL** — ACID compliance, rich indexing, strong SaaS track record

### ORM

- **Prisma** — strong TypeScript support, migrations, good productivity/control balance

### Cache & Sessions

- **Redis** — sessions, rate limiting, OTPs, live usage counters, frequently accessed data

### Queue

- **BullMQ + Redis** — emails, notifications, invoice generation, image processing, background jobs

### Storage

- **AWS S3** (or MinIO in development) — product images, logos, documents, invoices
- **CloudFront (CDN) in front of S3 from day one** — storefront performance directly affects conversion; don't defer this

### Search

- Start with **PostgreSQL full-text search**
- Move to Elasticsearch/OpenSearch only if requirements outgrow it

### Payments (two distinct systems — see Section 8)

- **Stripe Billing** — platform subscription revenue (tenants pay you)
- **Stripe Connect (Express accounts)** — merchant payments (customers pay tenants), with an application fee per transaction as a commerce revenue stream

---

## 3. Architecture Decision: Modular Monolith (not Microservices)

**Decision: Modular monolith, organized in a monorepo.**

Monorepo vs. polyrepo (code organization) and monolith vs. microservices (deployment architecture) are separate questions. This plan resolves both:

**Why modular monolith:**

- The module structure below already delivers separation of concerns and testability without the operational cost of microservices.
- Microservices solve problems this project doesn't have yet: independent team deployment, wildly different per-module scaling needs, or a large engineering org. None apply at this stage.
- Multi-tenancy + microservices means re-solving tenant isolation at every service boundary instead of once, centrally.
- Order flows touch inventory, payments, customers, and notifications — one DB transaction in a monolith vs. a distributed saga pattern in microservices, with no payoff at current scale.

**When to revisit:** extract a specific service only when a specific bottleneck appears (e.g., image/video processing volume, search moving to OpenSearch, an analytics ingestion pipeline at high volume) — never as a preemptive rewrite.

**Monorepo layout (Turborepo):**

```
apps/
  web/              (Next.js — storefront + tenant dashboard)
  api/              (NestJS modular monolith)
  worker/           (BullMQ job processor — same codebase, separate process)
packages/
  shared-types/     (Zod schemas, DTOs shared between web and api)
  ui/               (shared React components, if needed)
```

`worker` and `api` share the same NestJS modules and Prisma client without code duplication. The `worker` process is already a natural extraction point if something needs to be peeled out into its own service later.

---

## 4. Database Strategy

**Shared database, shared schema.** Every tenant-owned table includes a `tenant_id` column.

```
Product
-------
id
tenant_id
name
price
```

**Benefits:** lower cost, easier maintenance and deployment, scales well for the vast majority of SaaS businesses.

**Tenant isolation enforcement — do both, layered:**

1. **PostgreSQL Row-Level Security (RLS)** as the actual enforcement layer:
   - Enable RLS on every tenant-owned table.
   - Policy: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
   - A request-scoped NestJS interceptor opens a Prisma transaction and runs `SET LOCAL app.tenant_id = '<id>'` before any query executes.
2. **Prisma Client extension** to auto-inject `tenant_id` into `where` clauses as defense-in-depth — catches bugs early in development, before they'd ever reach RLS.
3. **Background jobs (BullMQ)** have no "request" context — pass `tenant_id` explicitly in the job payload and set the session variable manually in the worker before running queries.

Never trust the client to specify `tenant_id`; always derive it from the authenticated context.

**Required CI gate:** a dedicated cross-tenant isolation test suite — seed two tenants, assert every list/get endpoint returns 403/empty when queried with the wrong tenant's JWT. Treat this as a required check, not optional.

---

## 5. Tenant Identification

- Primary: subdomain — `company.yourapp.com` (e.g., `nike.yourapp.com`)
- Custom domains supported later (see Section 10)

---

## 6. Authentication & Authorization

**Authentication:** JWT access token + refresh token, with email verification, password reset, optional Google login, and two-factor authentication as a later addition.

**Roles:**

- Platform: Super Admin
- Tenant: Owner, Admin, Manager, Staff
- Store: Customer

**Authorization:** Role-Based Access Control (RBAC) with configurable permissions — never hardcode permissions.

```
Products → Create, Read, Update, Delete
Orders   → Read, Update, Refund
Inventory → Manage
```

Roles receive permissions. Users receive roles.

---

## 7. Plan Limits & Usage Enforcement

Subscription plans need actual enforcement, not just a concept:

- `usage_counters` table: `(tenant_id, metric, period, count)` — e.g., `orders_this_month`, `products_total`, `staff_seats`, `storage_bytes`.
- **Low-frequency limits** (staff seats, product count): checked synchronously in Postgres via a NestJS guard before the create action executes.
- **High-frequency limits** (order volume, API calls): incremented in Redis, reconciled to Postgres on a periodic cron — avoids hitting Postgres on every write just to check a limit.
- Limits defined declaratively per plan tier (`plan_limits` config/table), not hardcoded in guards, so changing a plan doesn't require a deploy.

---

## 8. Payment Architecture

Two distinct systems — do not conflate them:

**Platform billing** (tenants pay you):

- Stripe Billing with Products/Prices per plan tier (Basic/Pro/Enterprise).
- Stripe Checkout for subscription signup.
- Webhooks (`invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`) sync plan status into the `tenants` table.

**Merchant payments** (tenants' customers pay tenants):

- Stripe Connect, **Express accounts** — hosted onboarding, less compliance burden than Custom accounts, more brand control than Standard.
- Application fee (e.g., 1–2%) per transaction as a commerce revenue stream.
- `payment_accounts` table: `tenant_id` → Stripe Connect account ID, with `onboarding_status` (`not_started`, `pending`, `active`, `restricted`) gating whether the storefront can accept checkout.

**Webhook idempotency:** `webhook_events` table keyed on `(source, event_id)` with a unique constraint — insert-or-skip before processing any Stripe/carrier webhook. (Named to match the ERD's `WEBHOOK_EVENT` entity — one name across all docs.)

---

## 9. Tenant Lifecycle

Explicit state on the `tenants` table, not implicit:

```
trial → active → past_due → suspended → offboarded
```

- A scheduled job checks Stripe subscription status daily and transitions states.
- Suspended tenants see a "store temporarily unavailable" page instead of a raw 404/500.
- Offboarding needs a defined data export/deletion flow for compliance.

---

## 10. Custom Domains (Phase 6)

- Infrastructure: **ALB + ACM** (if on AWS) over manual Nginx + Certbot — ACM issues and renews certs automatically on DNS validation, removing a whole class of expiry incidents.
- Flow:
  1. Tenant adds `shop.theirdomain.com`.
  2. Platform provides a CNAME target (`tenants.yourapp.com`).
  3. Platform polls/verifies DNS resolution.
  4. On verification, trigger ACM cert request.
  5. Mark domain `active` in a `custom_domains` table.
  6. Request router resolves `tenant_id` from the `Host` header, falling back to subdomain resolution otherwise.
- Known edge cases to design for: domain squatting by a malicious tenant, verification races, cert renewal failures needing alerting.
- Correctly scoped as a Phase 6 item — genuinely a multi-day feature, not a config flag.

---

## 11. Core Modules

**Platform:** Authentication · Tenant Management · Subscription · Billing · Plans · Notifications · Audit Logs · File Storage · Settings

**Store:** Products · Categories · Brands · Attributes · Variants · Inventory · Customers · Orders · Coupons · Reviews · Shipping · Taxes

**Analytics:** Revenue · Sales · Customers · Best Sellers · Inventory Reports

---

## 12. API Style

REST, versioned from day one:

```
/api/v1/auth
/api/v1/products
/api/v1/orders
/api/v1/customers
/api/v1/tenants
```

---

## 13. Frontend Structure

```
Landing Website → Authentication → Tenant Dashboard → Storefront → Platform Admin
```

Kept as clearly separated concerns/sections for future scaling.

---

## 14. Backend Module Structure

```
src/
  modules/
    authentication/
    tenant/
    users/
    roles/
    products/
    categories/
    inventory/
    orders/
    customers/
    payments/
    shipping/
    analytics/
    notifications/
    subscriptions/
    billing/
  common/
  config/
```

Each module owns its controllers, services, DTOs, and database logic.

---

## 15. Security

Included from day one, not retrofitted:

- Tenant isolation (RLS + Prisma-layer scoping, Section 4)
- RBAC with configurable permissions
- Rate limiting (Redis-backed)
- Helmet / security headers
- Input & request validation (Zod/class-validator)
- SQL injection prevention (parameterized queries via Prisma)
- XSS protection
- CSRF protection where applicable
- Secure password hashing (Argon2 or bcrypt)
- Audit logging
- Encrypted secrets
- `tenant_id` always derived from authenticated context — never from client input

---

## 16. Observability

- `tenant_id` propagated via `AsyncLocalStorage` through the request lifecycle.
- Structured logging (e.g., `nestjs-pino`) with a request-scoped child logger carrying `tenant_id` — set from the same interceptor that configures the RLS session variable, so one code path covers both isolation and observability.
- Metrics via Prometheus + Grafana (or a managed equivalent).

---

## 17. Infrastructure

- Docker
- GitHub Actions (CI/CD)
- ALB/Nginx
- Redis
- PostgreSQL
- S3-compatible object storage + CloudFront
- Monitoring: Prometheus + Grafana or managed service
- Structured logging

---

## 18. Development Roadmap

**Phase 1 — Platform Foundation**
Authentication · Tenants · Roles · Permissions

**Phase 2 — Commerce Core**
Products · Categories · Inventory · Customers

**Phase 3 — Sales**
Cart · Checkout · Orders · Payments (platform billing + Stripe Connect onboarding — treat as its own explicit workstream, not a subtask)

**Phase 4 — Business Features**
Coupons · Shipping · Taxes · Reports

**Phase 5 — SaaS Features**
Subscriptions · Billing · Plans · Tenant limits (usage enforcement, Section 7)

**Phase 6 — Advanced**
Custom domains · Webhooks · Public API · Mobile API · Multi-language · Multi-currency · Multi-warehouse

---

## 19. Coding Standards

- TypeScript everywhere
- ESLint + Prettier
- Environment-based configuration
- Unit tests for business logic
- Integration tests for APIs
- Cross-tenant isolation tests as a required CI gate (Section 4)
- Swagger/OpenAPI documentation
- Conventional commits
- Database migrations under version control

---

## 20. Final Architecture Diagram

```
                     Internet
                         │
                 Next.js Frontend
                         │
                   REST API (NestJS — Modular Monolith)
                         │
     ┌───────────────────┼────────────────────┐
     │                    │                    │
 Authentication       Commerce             Platform
     │                    │                    │
 Users                Products             Tenants
 Roles                Inventory            Billing (Stripe Billing)
 Permissions          Orders               Plans / Usage Limits
 Customers            Payments (Stripe     Notifications
 Analytics            Connect)             Audit Logs
     │
 PostgreSQL (Shared DB, Shared Schema + RLS)
        │
      Redis (sessions, rate limiting, usage counters)
        │
     BullMQ Worker (emails, invoices, image processing)
        │
     S3 Storage → CloudFront (CDN)
```

---

## 21. Summary Recommendation

| Layer             | Choice                                                                          |
| ----------------- | ------------------------------------------------------------------------------- |
| Frontend          | Next.js + TypeScript + Tailwind CSS                                             |
| Backend           | NestJS + TypeScript (modular monolith)                                          |
| Code organization | Monorepo (Turborepo)                                                            |
| Database          | PostgreSQL, shared DB/shared schema + Row-Level Security                        |
| ORM               | Prisma                                                                          |
| Authentication    | JWT + Refresh Tokens                                                            |
| Authorization     | RBAC with configurable permissions                                              |
| Caching & Queues  | Redis + BullMQ                                                                  |
| Storage           | S3-compatible + CloudFront                                                      |
| Platform billing  | Stripe Billing                                                                  |
| Merchant payments | Stripe Connect (Express)                                                        |
| Deployment        | Docker + GitHub Actions CI/CD                                                   |
| Architecture      | Modular monolith, extract services only when a specific bottleneck justifies it |
