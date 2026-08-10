# Development Roadmap & Milestones

## Multi-Tenant SaaS Commerce Platform

Each phase lists scope, key deliverables, and exit criteria (what must be true to consider the phase done). Timeframes are indicative estimates for a small team (2–4 engineers) and should be adjusted to actual team size/velocity.

---

## Phase 1 — Platform Foundation
**Estimated duration: 3–4 weeks**

**Scope:** Authentication, tenants, roles, permissions, monorepo/infra bootstrap.

**Deliverables:**
- Monorepo scaffolded (Turborepo, `apps/web`, `apps/api`, `apps/worker`, `packages/shared-types`)
- PostgreSQL schema for `tenants`, `users`, `roles`, `permissions`; RLS policies enabled and tested
- Tenant context resolution middleware (subdomain-based) + `AsyncLocalStorage` propagation
- JWT auth (access + refresh), email verification, password reset
- RBAC guard wired to permission matrix (Section 3 of planning docs)
- Tenant registration & onboarding flow (subdomain selection, plan selection)
- CI/CD pipeline (GitHub Actions): lint, test, build, deploy to staging
- Cross-tenant isolation test suite established as a required CI gate

**Exit criteria:** A new business can register, verify email, log in, invite a staff member with a role, and confirm that tenant B's data is fully inaccessible via tenant A's session (automated test passing).

---

## Phase 2 — Commerce Core
**Estimated duration: 4–5 weeks**

**Scope:** Products, categories, brands, attributes, variants, inventory, customers.

**Deliverables:**
- Product CRUD with categories, brands, custom attributes, variants
- Bulk CSV import/export
- Inventory tracking with stock adjustment history and low-stock alerts
- Customer registration/login (storefront-facing) and customer management (tenant-facing)
- S3 + CloudFront integration for product images
- Tenant dashboard UI: product catalog management, inventory views

**Exit criteria:** A tenant can fully populate a catalog (products, variants, stock) and a test customer account can browse it via the storefront.

---

## Phase 3 — Sales
**Estimated duration: 5–6 weeks** (largest phase — includes payment integration)

**Scope:** Cart, checkout, orders, platform billing, and merchant payments.

**Deliverables:**
- Cart and checkout flow (address, shipping method selection, tax calculation)
- Order creation, status lifecycle, fulfillment tracking
- **Stripe Billing integration** (platform subscription charges to tenants)
- **Stripe Connect (Express) onboarding flow** for tenants — treated as its own dedicated workstream given its complexity
- Webhook handling with idempotency (`webhook_events` table) for both Stripe products
- Refund flow (full/partial)
- Order confirmation and status update emails (via BullMQ + email provider)
- Payment account status gating on storefront checkout availability

**Exit criteria:** A test tenant can connect a Stripe Express account, a test customer can complete a real (test-mode) purchase end-to-end, receive a confirmation email, and the tenant can see the order and issue a refund.

---

## Phase 4 — Business Features
**Estimated duration: 3–4 weeks**

**Scope:** Coupons, shipping, taxes, reviews, reporting.

**Deliverables:**
- Coupon engine (percentage/fixed, usage limits, product/category restrictions)
- Shipping zone & rate configuration
- Tax rule configuration per region
- Product reviews with moderation workflow
- Analytics dashboards: revenue, orders, best sellers, inventory reports
- CSV/PDF report export

**Exit criteria:** A tenant can run a discounted promotion, configure region-specific shipping/tax, and view accurate sales analytics for a completed order set.

---

## Phase 5 — SaaS Features
**Estimated duration: 3 weeks**

**Scope:** Subscriptions, billing UI, plans, tenant usage limits.

**Deliverables:**
- `usage_counters` table + Redis-backed live counters for high-frequency metrics
- `plan_limits` configuration and enforcement guard on relevant endpoints
- Plan upgrade/downgrade flow from tenant dashboard
- Billing invoice history view
- Dunning flow: failed payment → grace period → suspension, with tenant notifications at each step
- Tenant lifecycle states (`trial`, `active`, `past_due`, `suspended`, `offboarded`) modeled and enforced
- Super Admin console: view all tenants, manually adjust plans, suspend/reactivate

**Exit criteria:** A tenant exceeding a plan limit (e.g., staff seats) is correctly blocked with a clear upgrade prompt; a simulated failed payment correctly moves a tenant through the suspension flow.

---

## Phase 6 — Advanced
**Estimated duration: 4–6 weeks** (features can ship independently/in parallel once core platform is stable)

**Scope:** Custom domains, webhooks (outbound), public API, mobile API, multi-language, multi-currency, multi-warehouse.

**Deliverables:**
- Custom domain flow: DNS verification, ACM/TLS provisioning, `Host`-header-based tenant resolution
- Outbound webhook system for tenants to receive events (order.created, product.updated, etc.)
- Public API tier with API key authentication for tenant integrations
- Mobile-optimized API endpoints (if a native app is planned)
- i18n framework for multi-language storefronts
- Multi-currency pricing and display
- Multi-warehouse inventory tracking

**Exit criteria:** A tenant can point a real custom domain at their store with automated TLS, and at least one external integration successfully consumes the public API or a webhook.

---

## Cross-Cutting Milestones (ongoing throughout all phases)

| Milestone | When |
|---|---|
| Cross-tenant isolation tests pass in CI | From Phase 1 onward, on every PR |
| OpenAPI/Swagger spec kept in sync | Continuous, checked in CI |
| Security review (RBAC coverage, RLS policy audit) | End of Phase 1, re-checked end of Phase 3 — **done, end of Phase 6 (2026-08-06): see `09-security-review.md`** |
| Load/performance testing against NFR targets (Section 1–2 of NFR doc) | End of Phase 3, before public launch — **done, end of Phase 6 (2026-08-06): see `10-performance-load-test.md`** (found and fixed an unbounded-list-endpoint bottleneck; writes and NFR-PF-04 confirmed clean) |
| Observability (structured logging, dashboards, alerting) fully wired | End of Phase 2, expanded through Phase 5 |
| Accessibility audit (WCAG 2.1 AA) on storefront | End of Phase 4 |
| Data export/deletion (compliance) flow tested | End of Phase 5 |

---

## Suggested Release Strategy

- **Internal alpha** — end of Phase 3 (core commerce loop functional, test-mode payments only)
- **Private beta** — end of Phase 5 (real payments, plan enforcement, a small set of onboarded pilot tenants)
- **Public launch** — after Phase 6 core items (custom domains, public API) are stable, or launched incrementally as each Phase 6 feature completes independently
