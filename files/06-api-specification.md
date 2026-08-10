# API Specification

## Multi-Tenant SaaS Commerce Platform — REST API v1

**Base URL:** `https://api.yourapp.com/api/v1`

**Auth:** Bearer JWT in `Authorization` header, unless marked Public. Tenant context is derived server-side from the JWT claim or resolved `Host`/subdomain — never accepted as a request parameter. As of §19, an `X-API-Key` header is an equivalent alternate credential for this entire API — every `Bearer (tenant, ...)`-gated route below accepts either.

**Conventions:**
- Standard success envelope: `{ "data": ..., "meta": {...} }`
- Standard error envelope: `{ "error": { "code": "...", "message": "...", "details": [...] } }`
- Pagination: `?page=1&limit=20`, response includes `meta.total`, `meta.page`, `meta.limit`
- All list endpoints support filtering/sorting via query params documented per-resource

---

## 1. Authentication — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a new tenant owner + tenant |
| POST | `/auth/login` | Public | Log in, returns access + refresh token |
| POST | `/auth/refresh` | Public (refresh token) | Exchange refresh token for new access token |
| POST | `/auth/logout` | Bearer | Revoke current session |
| POST | `/auth/verify-email` | Public | Verify email via token |
| POST | `/auth/forgot-password` | Public | Trigger password reset email |
| POST | `/auth/reset-password` | Public (reset token) | Set new password |
| POST | `/auth/2fa/enable` | Bearer | Enable TOTP 2FA |
| POST | `/auth/2fa/verify` | Bearer | Verify TOTP code |
| GET | `/auth/me` | Bearer | Get current authenticated user + active tenant context |
| POST | `/auth/switch-tenant` | Bearer | Switch active tenant for multi-tenant users |
| GET | `/auth/sessions` | Bearer | List active sessions (device/IP/created_at) for current user |
| DELETE | `/auth/sessions/:id` | Bearer | Revoke one specific session |
| POST | `/auth/logout-all` | Bearer | Revoke all sessions for current user (logout from all devices — FR-A-07) |

---

## 2. Tenants — `/tenants`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tenants/me` | Bearer (tenant) | Get current tenant's profile/settings |
| PATCH | `/tenants/me` | Bearer (tenant, Admin+) | Update tenant profile/branding/settings |
| GET | `/tenants/me/audit-logs` | Bearer (tenant, Owner/Admin) | View the current tenant's own audit log — FR-AU-02, added during implementation (the matrix already granted Owner/Admin `audit_log.view`; this doc had no endpoint for it) |
| POST | `/tenants/me/export` | Bearer (tenant, `compliance.manage`) | Request a data export — FR-AU-03/NFR-CP-01, data portability "on request," independent of offboarding. See §18 |
| GET | `/tenants/me/export` | Bearer (tenant, `compliance.manage`) | List the tenant's own export requests. See §18 |
| GET | `/tenants` | Bearer (Super Admin) | List all tenants |
| GET | `/tenants/:id` | Bearer (Super Admin) | Get tenant detail |
| PATCH | `/tenants/:id/status` | Bearer (Super Admin) | Suspend / reactivate / offboard tenant. Transitioning to `offboarded` sets `offboardedAt` and auto-triggers the same data-export pipeline `POST /tenants/me/export` uses (FR-AU-03) — see §18 for the retention/deletion timeline this then starts |
| GET | `/tenants/:id/audit-logs` | Bearer (Super Admin) | View tenant's audit trail |
| POST | `/tenants/:id/impersonate` | Bearer (Super Admin) | Issue a short-lived (15 min), non-renewable impersonation token scoped to the tenant's Owner role; writes an `AUDIT_LOG` entry (`action: tenant.impersonate`) on issuance, tagged with the Super Admin's user id |
| POST | `/tenants/:id/plan-override` | Bearer (Super Admin) | Grant a temporary limit override (writes a `TENANT_PLAN_OVERRIDE` row) — FR-P-08. Body: `{ metric, overrideValue, reason, expiresAt }`; `grantedByUserId` is set server-side from the caller, not accepted in the body. An active (non-expired) override for a metric always wins over the tenant's plan's own `PlanLimit` row when `PlanLimitGuard` resolves the effective limit — implemented Phase 5 |
| GET | `/tenants/:id/plan-override` | Bearer (Super Admin) | List active/past overrides for a tenant — implemented Phase 5 |

---

## 3. Users & Roles — `/users`, `/roles`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users` | Bearer (tenant, Admin+) | List staff users in current tenant |
| POST | `/users/invite` | Bearer (tenant, Admin+) | Invite a staff member by email |
| PATCH | `/users/:id` | Bearer (tenant, Admin+) | Update staff user (role, status) |
| DELETE | `/users/:id` | Bearer (tenant, Admin+) | Remove staff member |
| GET | `/roles` | Bearer (tenant, Admin+) | List roles for current tenant |
| POST | `/roles` | Bearer (tenant, Admin+) | Create custom role |
| PATCH | `/roles/:id` | Bearer (tenant, Admin+) | Update role permissions |
| DELETE | `/roles/:id` | Bearer (tenant, Admin+) | Delete custom role |
| GET | `/permissions` | Bearer (tenant, Admin+) | List all available permission codes |

---

## 4. Products — `/products`, `/categories`, `/brands`, `/attributes`

Staff-facing CRUD below is Bearer-only, all statuses (draft + published). **Deviation from this doc's original "Bearer / Public" dual-mode note, disclosed during implementation:** this codebase's guard chain skips JWT verification entirely for `@Public()` routes rather than optionally attempting it, so one route can't cleanly serve both an authenticated staff view and an anonymous published-only view. Public, unauthenticated browsing is instead served by a wholly separate `/storefront/products` namespace (§4a) — always public, always published-only — mirroring the frontend's own separate storefront route group.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products` | Bearer (tenant) | List products, all statuses (filters: category, status, search) |
| POST | `/products` | Bearer (tenant, Manager+) | Create product (optionally with its first variant inline) |
| GET | `/products/:id` | Bearer (tenant) | Get product detail incl. variants, images, attribute values |
| PATCH | `/products/:id` | Bearer (tenant, Manager+) | Update product |
| DELETE | `/products/:id` | Bearer (tenant, Admin+) | Delete product (best-effort cleanup of its stored images) |
| POST | `/products/:id/variants` | Bearer (tenant, Manager+) | Add variant (auto-creates its `Inventory` row against the tenant's default warehouse) |
| PATCH | `/products/:id/variants/:variantId` | Bearer (tenant, Manager+) | Update variant |
| POST | `/products/:id/attributes` | Bearer (tenant, Manager+) | Set an attribute value on the product |
| POST | `/products/:id/images/presign` | Bearer (tenant, Manager+) | Get a presigned direct-to-storage upload URL (`{ uploadUrl, publicUrl, key }`) — browser PUTs the file bytes straight to storage, the API never sees them |
| POST | `/products/:id/images` | Bearer (tenant, Manager+) | Confirm a completed upload and persist the `ProductImage` row (`{ key }`) |
| DELETE | `/products/:id/images/:imageId` | Bearer (tenant, Manager+) | Delete an image (row + underlying stored object) |
| POST | `/products/import` | Bearer (tenant, Manager+) | Bulk CSV import — one row per product + its default variant, 5,000-row cap, synchronous (no queue), returns a per-row success/failure summary |
| GET | `/products/export` | Bearer (tenant, Manager+) | Bulk CSV export (`text/csv`), same row shape as import |
| GET | `/categories` | Bearer (tenant) | List categories |
| POST | `/categories` | Bearer (tenant, Manager+) | Create category |
| PATCH | `/categories/:id` | Bearer (tenant, Manager+) | Update category |
| DELETE | `/categories/:id` | Bearer (tenant, Admin+) | Delete category |
| GET | `/brands` | Bearer (tenant) | List brands |
| POST | `/brands` | Bearer (tenant, Manager+) | Create brand |
| GET | `/attributes` | Bearer (tenant) | List custom attributes |
| POST | `/attributes` | Bearer (tenant, Manager+) | Create attribute |

### 4a. Storefront (public) — `/storefront/products`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/storefront/products` | Public | List **published-only** products for the tenant resolved from `Host`/subdomain (`X-Tenant-Subdomain` header in dev) |
| GET | `/storefront/products/:slug` | Public | Get a published product's detail by slug; 404s (`TENANT_NOT_FOUND`) if no store resolves, or (`RESOURCE_NOT_FOUND`) if the slug doesn't match a published product |

---

## 5. Inventory — `/inventory`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/inventory` | Bearer (tenant) | List stock levels (filters: `lowStock=true`, `warehouseId`) |
| PATCH | `/inventory/:variantId` | Bearer (tenant, Manager+) | Adjust stock by a signed `delta`; requires a `reasonCode` (`sale`\|`return`\|`damage`\|`manual_correction`\|`initial_stock`), rejects if it would go negative; writes an `InventoryAdjustment` row |
| PATCH | `/inventory/:variantId/threshold` | Bearer (tenant, Manager-role-with-`inventory.manage_alerts`) | Set the low-stock threshold used by `?lowStock=true` — a distinct permission from `inventory.adjust` per the Phase 1 permission matrix, so kept as its own endpoint rather than folded into the adjust call |
| GET | `/inventory/:variantId/history` | Bearer (tenant) | View stock adjustment history (all `InventoryAdjustment` rows for the variant) |

Low-stock **alert delivery** (as opposed to the queryable filter/threshold above) is out of scope for this phase — the `Notifications` module doesn't exist yet; not to be mistaken for an oversight.

---

## 6. Customers — `/customers`

Two independent identity spaces share the `/customers` path prefix: storefront customers (public registration/login, own-profile-only) and tenant staff managing the customer list. Separate JWTs, secrets, guards, and session tables — a customer token is never valid on a staff route or another tenant's store, and vice versa.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/customers/register` | Public (storefront) | Customer self-registration; sets an httpOnly `customer_refresh_token` cookie |
| POST | `/customers/login` | Public (storefront) | Customer login |
| POST | `/customers/refresh` | Public (storefront, refresh cookie) | Rotate refresh token, issue new access token |
| POST | `/customers/logout` | Public (storefront, refresh cookie) | Revoke the current customer session |
| GET | `/customers` | Bearer (tenant, Staff+) | List tenant's customers (search by email); `passwordHash` is always stripped before the row leaves the API process |
| GET | `/customers/:id` | Bearer (tenant, Staff+) | Get customer detail |
| PATCH | `/customers/:id` | Bearer (tenant, Manager+) | Update customer record (segmentation tags, active status — fields a customer can't set on themselves) |
| GET | `/customers/me` | Bearer (customer) | Get own profile |
| PATCH | `/customers/me` | Bearer (customer) | Update own profile (narrower than the staff-facing DTO — no tags/isActive) |
| GET | `/customers/me/addresses` | Bearer (customer) | List own addresses |
| POST | `/customers/me/addresses` | Bearer (customer) | Add address |
| PATCH | `/customers/me/addresses/:addressId` | Bearer (customer) | Update own address |
| DELETE | `/customers/me/addresses/:addressId` | Bearer (customer) | Remove own address |

---

## 7. Cart & Checkout — `/cart`, `/checkout`

Cart is scoped to a logged-in customer only (FR-O-02 ties persistence to "logged-in customers") — there is no anonymous/guest cart, so no cart-merge-on-login case exists either. `/checkout/quote` and `/checkout/complete` share one request shape (`shippingAddress` + optional `couponCode`) — totals are always recomputed server-side from the live cart/coupon/shipping/tax config, never trusted from the client.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/cart` | Bearer (customer) | Get current cart (auto-created empty on first access) |
| POST | `/cart/items` | Bearer (customer) | Add item to cart (merges quantity if the variant is already in the cart) |
| PATCH | `/cart/items/:id` | Bearer (customer) | Update quantity |
| DELETE | `/cart/items/:id` | Bearer (customer) | Remove item |
| POST | `/checkout/quote` | Bearer (customer) | Preview subtotal/shipping/tax/discount/grand total for the current cart |
| POST | `/checkout/complete` | Bearer (customer) | Creates the `Order` (+ snapshotted `OrderItem`s) as `pending`, creates a Stripe PaymentIntent, clears the cart, returns `{ order, clientSecret }` |

---

## 8. Orders — `/orders`

**Deviation from this doc's original dual-mode `GET /orders/:id` ("Staff+ / customer, own only"), disclosed during implementation:** same guard-chain conflict `/products` already hit (`@Public()` fully skips JWT, can't cleanly co-exist with a differently-scoped guard on the same path). Resolved the same way: staff-only `GET /orders/:id`, customer-facing equivalent at `GET /customers/me/orders/:id`.

Order status lifecycle (FR-O-06): `pending → paid → fulfilled → shipped → delivered`, with `cancelled`/`refunded` reachable from the paid-or-later states. `pending → paid` happens via the Stripe webhook (`payment_intent.succeeded`), not synchronously in `/checkout/complete` — inventory decrements at that same moment (reason code `sale`), not at order creation, to avoid phantom stock holds from abandoned checkouts.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/orders` | Bearer (tenant, Staff+) | List orders (filters: `status`, `search` by customer email) |
| GET | `/orders/:id` | Bearer (tenant, Staff+) | Get order detail (items, payment transactions, refunds) |
| PATCH | `/orders/:id/status` | Bearer (tenant, Manager+) | Update order status and/or add a tracking number/carrier |
| POST | `/orders/:id/refund` | Bearer (tenant, Admin+) | Issue a full or partial refund (creates a Stripe refund + a `pending` `Refund` row; confirmed asynchronously by webhook, which also restocks inventory on a full refund) |
| GET | `/customers/me/orders` | Bearer (customer) | List own orders |
| GET | `/customers/me/orders/:id` | Bearer (customer) | Get own order detail (404s if it belongs to another customer) |

---

## 9. Payments — `/payments`, `/webhooks/stripe`

**Implementation note:** no Stripe test-mode credentials exist for this environment. `StripeService` is built against the real `stripe` SDK's types/methods throughout, but every method that would make a real network call to `api.stripe.com` is stub-mode-guarded (active whenever `STRIPE_SECRET_KEY` is unset), returning a deterministic, correctly-shaped stand-in instead — swapping in real keys is an env-var change only. Webhook signature verification/generation is a local HMAC operation, never stubbed. Platform Stripe Billing (charging tenants for their own SaaS subscription — distinct from Stripe **Connect**, which is what accepts customer payments on a tenant's behalf) is implemented as of Phase 5 — see §14.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payments/connect/onboard` | Bearer (tenant, `billing.connect_payment_account`) | Create the tenant's Stripe Connect Express account (idempotent) and return a fresh onboarding link URL |
| GET | `/payments/connect/status` | Bearer (tenant, `billing.connect_payment_account`) | Get the tenant's `PaymentAccount` row (`onboardingStatus`, `stripeAccountId`) — auto-created `not_started` at tenant registration |
| GET | `/payments/payouts` | Bearer (tenant, `payments.view`) | List the tenant's payment transactions |
| POST | `/webhooks/stripe/connect` | Public (signature-verified) | Stripe Connect webhook receiver — idempotent via `WebhookEvent`'s `(source, eventId)` unique constraint; handles `payment_intent.succeeded` (marks order paid, decrements inventory, enqueues the confirmation email) and `refund.updated` (marks refund/order/inventory accordingly) |
| POST | `/webhooks/stripe/billing` | Public (signature-verified) | Stripe Billing webhook receiver — same idempotency plumbing as `/webhooks/stripe/connect`. Dispatches `invoice.payment_failed` (upserts an `Invoice` row `status: open`; if the tenant is `active`, transitions it to `past_due`, sets `pastDueSince`, enqueues a payment-failed email) and `invoice.paid` (upserts the `Invoice` row `status: paid`; if the tenant is `past_due`, recovers it to `active`, clears `pastDueSince`, no email). `tenantId` is resolved from `invoice.parent.subscription_details.metadata.tenantId` — an immutable snapshot Stripe takes of the Subscription's own metadata at invoice-finalization time, not a DB lookup keyed on the (RLS-protected) local `Subscription` row |

---

## 10. Coupons — `/coupons`

`POST /coupons/validate` stays on this same controller rather than a separate public namespace — unlike Products, there's no *same-path* dual-mode conflict here (CRUD and `/validate` are different paths). A coupon can also be deactivated without deleting it, via `PATCH /coupons/:id` with `{ "isActive": false }` (keeps historical `CouponRedemption` rows queryable against a coupon record that still exists).

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/coupons` | Bearer (tenant, `coupons.manage`) | List coupons |
| POST | `/coupons` | Bearer (tenant, `coupons.manage`) | Create coupon |
| PATCH | `/coupons/:id` | Bearer (tenant, `coupons.manage`) | Update coupon (including deactivating it) |
| DELETE | `/coupons/:id` | Bearer (tenant, `coupons.manage`) | Delete coupon |
| POST | `/coupons/validate` | Public (storefront) | Anonymous-capable preview (active/expiry/usage-limit/min-order-value only) — the authoritative check (incl. per-customer limit and product/category restriction) happens inside `/checkout/complete`, which needs a real authenticated customer and cart |

---

## 11. Shipping & Tax — `/shipping-zones`, `/tax-rules`

**Scope note:** shipping rates are flat-rate + free-above-threshold only for this phase — FR-S-02's weight-based option is deferred (no `weight` column exists on `Product`/`ProductVariant` yet, and it isn't required by any current exit criteria).

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/shipping-zones` | Bearer (tenant, `shipping.view`) | List shipping zones, each with its rates |
| POST | `/shipping-zones` | Bearer (tenant, `shipping.manage`) | Create a shipping zone (`name`, `regions[]`) |
| PATCH | `/shipping-zones/:id` | Bearer (tenant, `shipping.manage`) | Update a shipping zone |
| DELETE | `/shipping-zones/:id` | Bearer (tenant, `shipping.manage`) | Delete a shipping zone |
| POST | `/shipping-zones/:id/rates` | Bearer (tenant, `shipping.manage`) | Add a rate (`flat_rate` or `free_above_threshold`) to a zone |
| PATCH | `/shipping-zones/rates/:rateId` | Bearer (tenant, `shipping.manage`) | Update a rate |
| DELETE | `/shipping-zones/rates/:rateId` | Bearer (tenant, `shipping.manage`) | Delete a rate |
| GET | `/tax-rules` | Bearer (tenant, `tax.view`) | List tax rules |
| POST | `/tax-rules` | Bearer (tenant, `tax.manage`) | Create a tax rule (`region`, `rate`, optional `categoryId` restriction) |
| PATCH | `/tax-rules/:id` | Bearer (tenant, `tax.manage`) | Update a tax rule |
| DELETE | `/tax-rules/:id` | Bearer (tenant, `tax.manage`) | Delete a tax rule |

---

## 12. Reviews — `/reviews`

**Phase 4.** Rating scale is 1–5 (FR-R-01 doesn't specify a number; standard e-commerce convention, enforced by Zod + a DB CHECK constraint). Submitting a review requires the customer to have a `paid`/`fulfilled`/`shipped`/`delivered` order containing that product (`pending`/`cancelled`/`refunded` don't count as a completed purchase) — a non-qualifying submission gets `403 NOT_ELIGIBLE`; a second submission for the same product gets `409 ALREADY_REVIEWED`. Moderation states are `pending` (default, not publicly visible) / `approved` / `rejected` / `hidden`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products/:id/reviews` | Public | List `approved` reviews for a product, plus `{ average, count }` |
| POST | `/products/:id/reviews` | Bearer (customer) | Submit a review (`rating` 1–5, optional `comment`) |
| GET | `/reviews` | Bearer (tenant, `reviews.view`) | Staff moderation queue (filters: `status`, `productId`) — additive beyond the original spec, needed for the dashboard queue page |
| PATCH | `/reviews/:id/moderate` | Bearer (tenant, `reviews.moderate`) | Approve/reject/hide review |

---

## 13. Analytics — `/analytics`

**Phase 4.** Every route below computes on the fly from `Order`/`OrderItem`/`Customer`/`Inventory` — no analytics table exists (matches `04-database-erd.mermaid`). Every route is gated by `reviews.view`'s analytics equivalent, `analytics.view`, **except `/analytics/export`, which additionally requires `analytics.export`** — Staff has `analytics.view` but not `analytics.export` (`packages/database/src/permissions.ts`), so Staff gets `403` on export specifically while every other route below 200s. The "Staff+" auth column below describes the route's minimum tier of existence, not the real permission gate.

Query params `from`/`to` (ISO 8601, ISO 8601, default: last 30 days) and `granularity` (`day`/`week`/`month`, default `day`) apply to `revenue`, `orders`, `products/best-sellers`, and `customers`. Revenue/order figures include only `paid`/`fulfilled`/`shipped`/`delivered` orders; a disclosed simplification is that partial refunds are not netted out of these totals. Best-sellers/low-performers group by the order's snapshotted product name/SKU (not a live product FK — `OrderItem` has none, by design, so historical accuracy survives product deletion). Inventory's `turnoverRatio` is a proxy (`unitsSoldInRange / currentQuantityOnHand`, `null` if there's no stock) — there's no COGS field or historical stock-snapshot table to compute a textbook turnover formula.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/analytics/revenue` | Bearer (tenant, Staff+) | Revenue over time range → `{ granularity, from, to, buckets: [{bucket, revenue}], totalRevenue }` |
| GET | `/analytics/orders` | Bearer (tenant, Staff+) | Order volume/AOV metrics → `{ buckets: [{bucket, orderCount, aov}], totalOrders, overallAOV }` |
| GET | `/analytics/products/best-sellers` | Bearer (tenant, Staff+) | Top/bottom performers → `{ bestSellers, lowPerformers }` |
| GET | `/analytics/customers` | Bearer (tenant, Staff+) | Acquisition/repeat-purchase metrics → `{ newCustomersByBucket, totalNewCustomers, repeatCustomers, oneTimeCustomers, repeatPurchaseRate }` |
| GET | `/analytics/inventory` | Bearer (tenant, Staff+) | Stock value/turnover report → `{ stockValue, unitsSoldInRange, currentQuantityOnHand, turnoverRatio, lowStockItems }` |
| GET | `/analytics/export` | Bearer (tenant, `analytics.export`) | Export report as CSV/PDF — query params: `type` (`revenue`/`orders`/`best-sellers`/`customers`/`inventory`), `format` (`csv`/`pdf`), plus the date-range params above |

---

## 14. Subscription & Billing (Platform) — `/billing`, `/plans`

Implemented Phase 5. Every tenant gets one `Subscription` row auto-created at registration, on whichever `Plan` has `isDefault: true` (seeded as the free "Free Trial" plan) — see `ensureDefaultSubscriptionForTenant`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/billing/plan` | Bearer (tenant, `billing.view`) | Current plan + subscription + usage: `{ plan, subscription, usage: [{ metric, limit, count }] }` for `staff_seats`/`product_count`/`order_volume`. `limit` is the *effective* limit (an active `TenantPlanOverride` wins over the plan's own `PlanLimit`, else `null` = unlimited) |
| POST | `/billing/upgrade` | Bearer (tenant, `billing.change_plan`) | Change subscription plan. Body: `{ planId }`. Creates a Stripe customer/subscription on first upgrade (lazily — a free-plan tenant has none), otherwise swaps the existing Stripe subscription's price in place. **Downgrade-blocking:** rejects with `400 DOWNGRADE_BLOCKED` (naming the specific over-limit metric) if current `staff_seats`/`product_count` usage already exceeds the *target* plan's own limits — deliberately ignores any active override, since an override is temporary and tenant-specific and shouldn't silently validate a permanent downgrade |
| GET | `/billing/invoices` | Bearer (tenant, `billing.view_invoices`) | List the tenant's `Invoice` rows (newest first) — populated exclusively by the `/webhooks/stripe/billing` handler, never a live Stripe API call. Each row links out to Stripe's own hosted invoice page/PDF (`hostedInvoiceUrl`/`invoicePdfUrl`) |
| GET | `/plans` | Public | List non-archived plans + their `PlanLimit` rows — pre-signup plan picker and the tenant upgrade UI both read this |
| POST | `/plans` | Bearer (Super Admin) | Create a plan. Body: `{ name, price, billingInterval, stripePriceId?, isDefault?, limits: [{ metric, maxValue }] }` |
| PATCH | `/plans/:id` | Bearer (Super Admin) | Update a plan (partial; `limits` when provided replaces the list wholesale, no per-metric merge) |
| POST | `/plans/:id/archive` | Bearer (Super Admin) | Soft-archive a plan (`archivedAt`, never a hard delete — existing `Subscription.planId` FKs must survive) — it disappears from `GET /plans` but existing subscribers are unaffected |

**Plan-limit enforcement:** `staff_seats` (`POST /users/invite`) and `product_count` (`POST /products`) are gated by `PlanLimitGuard`/`@EnforcePlanLimit(metric)`, returning `403 PLAN_LIMIT_EXCEEDED` with a message naming the limit and prompting an upgrade. `order_volume` is checked inline inside `POST /checkout/complete` instead (an atomic `UsageCounter` upsert immediately before `Order` creation, so a rejected checkout never leaves a stray Order) — it only applies when the effective limit resolves to a real number; the seeded free plan has no `order_volume` row, i.e. unlimited.

**Dunning (failed payment → grace period → suspension):** `invoice.payment_failed` moves a tenant `active → past_due` (see §9). `apps/worker`'s `DunningProcessor` runs an hourly (`DUNNING_CHECK_INTERVAL_MS`) job that suspends any tenant whose `pastDueSince` is older than `DUNNING_GRACE_PERIOD_DAYS` (default 3): `past_due → suspended`, audit-logged, account-suspended email sent to the tenant's owner. A suspended (or offboarded) tenant's **storefront** 403s with `TENANT_SUSPENDED` (`TenantResolverGuard`, subdomain-resolved requests only) — but its own staff **dashboard** stays reachable (tenant context there comes from the JWT claim, not the Host header), so staff can always reach `/dashboard/settings/billing` to fix the underlying payment issue.

---

## 15. Custom Domains — `/domains`

Implemented Phase 6 (round 1). Gated by the existing `settings.manage` permission (already documented as "Store profile/branding, custom domain setup" — no new permission code was needed). Ownership verification (DNS TXT lookup) is real, unstubbed; TLS/certificate provisioning is stub-mode in this environment (no AWS credentials — mirrors `StripeService.isStubMode`) and real production Host-header-based routing on the Next.js side is a disclosed, deferred follow-up (see the Phase 6 plan) — this API works standalone and is independently verified via a spoofed `Host` header.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/domains` | Bearer (tenant, `settings.manage`) | List the tenant's custom domains, each with a `dnsInstructions: { recordType: "TXT", recordName, value }` block |
| POST | `/domains` | Bearer (tenant, `settings.manage`) | Add a custom domain. Body: `{ domain }`. Generates a `verificationToken`, returns the domain (`status: pending_verification`) with its DNS TXT-record instructions. `409 CONFLICT` if the hostname is already registered to any tenant |
| POST | `/domains/:id/verify` | Bearer (tenant, `settings.manage`) | Runs a real `dns.promises.resolveTxt()` lookup against `_saas-verify.<domain>`; on a match, provisions a certificate (stub) and flips `status` to `verified`. A non-match is a graceful `400 VALIDATION_ERROR` (DNS propagation can take time) — `status` stays `pending_verification`, safe to retry |
| DELETE | `/domains/:id` | Bearer (tenant, `settings.manage`) | Remove a custom domain |

Once `verified`, `TenantResolverGuard` resolves requests whose `Host` header matches the domain (falling back to this lookup only when the host doesn't match `*.${APP_BASE_DOMAIN}`) — same `TENANT_NOT_FOUND`/`TENANT_SUSPENDED` semantics as ordinary subdomain resolution. `custom_domains` deliberately has **no RLS policy** (must be resolvable with zero tenant context, the same bootstrap reasoning as `tenants`/`plans`) — its tenant-scoped CRUD routes above are isolated at the app layer instead.

---

## 16. Notifications — `/notifications`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications` | Bearer | List in-app notifications for current user |
| PATCH | `/notifications/:id/read` | Bearer | Mark notification as read |
| GET | `/notifications/settings` | Bearer (tenant, Admin+) | Get notification configuration |
| PATCH | `/notifications/settings` | Bearer (tenant, Admin+) | Update notification configuration |

---

## 17. Outbound Webhooks — `/webhook-subscriptions`

Implemented Phase 6 (round 1). Distinct from `/webhooks/stripe/*` (§9), which are INBOUND Stripe receivers — these are tenant-configured endpoints that receive OUR platform's own events. Gated by a new permission, `webhooks.manage` (owner/admin tier, alongside `settings.manage`).

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/webhook-subscriptions` | Bearer (tenant, `webhooks.manage`) | List the tenant's webhook subscriptions (`secret` never included — see below) |
| POST | `/webhook-subscriptions` | Bearer (tenant, `webhooks.manage`) | Create a subscription. Body: `{ url, eventTypes: [...] }`. The response includes `secret` **once, at creation only** — never returned again by any other endpoint |
| PATCH | `/webhook-subscriptions/:id` | Bearer (tenant, `webhooks.manage`) | Update `url`/`eventTypes`/`isActive` (partial) |
| DELETE | `/webhook-subscriptions/:id` | Bearer (tenant, `webhooks.manage`) | Remove a subscription |
| GET | `/webhook-subscriptions/:id/deliveries` | Bearer (tenant, `webhooks.manage`) | Delivery log for a subscription (newest 100), each with `eventType`, `status` (`pending`/`delivered`/`failed`), `responseStatus`, `attempt` |

**Event vocabulary** (`WEBHOOK_EVENT_TYPES`, fixed and code-defined, not user-managed): `order.created`, `order.status_changed`, `product.created`, `product.updated`, `product.deleted`. Dispatched by direct calls from `CheckoutService`/`OrdersService`/`ProductsService` at the point of the state change into `WebhookDispatchService` — no event-emitter abstraction, matching this codebase's existing preference for explicit, direct queue enqueues.

**Delivery** (`apps/worker`'s `WebhookDeliveryProcessor`): each event creates one `WebhookDelivery` row per matching active subscription and enqueues a BullMQ job. The processor POSTs the JSON payload with:
- `X-Webhook-Event`: the event type
- `X-Webhook-Delivery-Id`: the delivery's id
- `X-Webhook-Signature`: `sha256=<HMAC-SHA256(subscription.secret, rawBody)>` — verify this the same way you'd verify a Stripe webhook, using your own signing secret

A non-2xx response or network error is retried by BullMQ's own job-level backoff (5 attempts, exponential starting at 5s); `status` stays `pending` through every retry and only flips to `delivered` (2xx) or `failed` (after every retry is exhausted) once the outcome is final.

---

## 18. Compliance — Data Export & Deletion

Implemented — closes the "Data export/deletion (compliance) flow tested" cross-cutting milestone (FR-AU-03, NFR-CP-01, NFR-CP-02). Endpoints live on `/tenants` (§2) — `POST`/`GET /tenants/me/export`, gated by a new owner-only permission, `compliance.manage` (excluded from `admin`, same tier as `billing.change_plan`).

**Two triggers, one pipeline:**
- **Self-service** (`POST /tenants/me/export`) — a tenant can request a copy of its own data at any time, independent of offboarding (NFR-CP-01's "on request" data portability).
- **Offboarding-triggered** (automatic) — when a Super Admin transitions a tenant to `offboarded` via `PATCH /tenants/:id/status` (§2), the same export pipeline fires automatically and `Tenant.offboardedAt` is set, starting the retention clock (FR-AU-03/NFR-CP-02).

**Export content** (`apps/worker`'s `DataExportProcessor`): one JSON document per request, uploaded to storage and linked via a 7-day presigned download URL (never the public, unexpiring URL product images use — this blob can contain PII). Covers the tenant's real business data: users (minus `passwordHash`), roles, products (+variants/images/attributes/categories/brands), customers (minus `passwordHash`, +addresses), orders (+items/transactions/refunds), coupons, reviews, shipping zones/rates, tax rules, subscription, invoices, custom domains, webhook subscriptions (minus `secret`). Deliberately excluded: `AuditLog`/`WebhookDelivery`/`InventoryAdjustment`/`UsageCounter` (high-volume internal/operational logs, not the tenant's own portable business data) and `Session`/`CustomerSession`/`VerificationToken` (security tokens).

**Retention & deletion** (`apps/worker`'s `DataRetentionProcessor`, a recurring job — `DATA_RETENTION_CHECK_INTERVAL_MS`, default daily): any tenant whose `status` is `offboarded` and whose `offboardedAt` is older than `DATA_RETENTION_DAYS` (default 30) is **permanently and irreversibly deleted** — one `prisma.tenant.delete()` call, which cascades through every tenant-scoped table (`onDelete: Cascade` end-to-end, confirmed against every migration's actual SQL). The tenant's owner receives a confirmation email (captured before the delete — nothing to look up afterward). A stale JWT for an already-deleted tenant is rejected cleanly (`401 UNAUTHORIZED`), not a server error.

---

## 19. Public API — API-Key Authentication — `/api-keys`

Implemented — closes the roadmap's "Public API tier with API key authentication for tenant integrations" line. There is no separate curated "public API" endpoint set: an API key is a drop-in alternate credential for **the entire existing tenant-facing REST API** documented in this file (§1-§18). Any route already gated by `Bearer (tenant, ...)` accepts an `X-API-Key` header instead, with identical RBAC, identical tenant isolation, identical everything — because `RbacGuard`/`PlanLimitGuard`/`CurrentUser`/`CurrentTenantId` only ever read `request.user`/`request.tenantId`, never which credential populated them.

**Key management**, gated by a new permission, `api_keys.manage` (owner/admin tier, same tier as `webhooks.manage`):

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api-keys` | Bearer (tenant, `api_keys.manage`) | List the tenant's keys (`keyPreview`, `name`, `lastUsedAt`, `expiresAt`, `revokedAt`, `createdAt` — never the plain key or its hash) |
| POST | `/api-keys` | Bearer (tenant, `api_keys.manage`) | Create a key. Body: `{ name }`. The response includes the full plain key (`sat_<48 hex chars>`) **once, at creation only** — never returned again by any other endpoint |
| DELETE | `/api-keys/:id` | Bearer (tenant, `api_keys.manage`) | Soft-revoke (`revokedAt = now()`) — never a hard delete, preserving the audit trail |

**Identity & permissions:** a key always authenticates as the user who created it, and inherits that user's real, current permission set on every single request (re-resolved fresh via `UserRole`→`Role`→`RolePermission`, exactly like that user's own JWT) — not a snapshot taken at key-creation time. If that user's role is later changed or their account deactivated, every one of their existing keys reflects it immediately. There is no separate scoped-permission model for keys (round 1) — a key can do everything its creator can.

**Using a key:** send `X-API-Key: sat_...` instead of `Authorization: Bearer ...` on any request. No other header is required — tenant resolution falls back to the key's own `tenantId` when no `Host`/subdomain signal is present, and any subdomain that resolves to a *different* tenant than the key's own is rejected (`403 FORBIDDEN`) rather than silently ignored.

**Rejection cases:** an unknown, revoked, or expired key is rejected with `401 UNAUTHORIZED`. Absent the `X-API-Key` header entirely, this mechanism is a complete no-op — normal JWT-authenticated requests are unaffected.

---

## Standard Error Codes

| Code | Meaning |
|---|---|
| `UNAUTHORIZED` | Missing/invalid token |
| `FORBIDDEN` | Valid token, insufficient permission |
| `TENANT_NOT_FOUND` | Tenant context could not be resolved |
| `TENANT_SUSPENDED` | Tenant is suspended/past-due |
| `PLAN_LIMIT_EXCEEDED` | Action blocked by subscription plan limit |
| `DOWNGRADE_BLOCKED` | Plan downgrade rejected — current usage already exceeds the target plan's limit |
| `VALIDATION_ERROR` | Request body failed schema validation |
| `RESOURCE_NOT_FOUND` | Requested resource does not exist (or belongs to another tenant) |
| `CONFLICT` | Duplicate resource (e.g., SKU, subdomain) |
| `PAYMENT_FAILED` | Payment processing error |
| `RATE_LIMITED` | Too many requests |

Full request/response schemas are to be maintained in the OpenAPI/Swagger spec generated from NestJS decorators, kept in sync with implementation per NFR-M-04.
