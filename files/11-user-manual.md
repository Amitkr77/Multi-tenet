# User Manual — Manual Testing Guide

## Multi-Tenant SaaS Commerce Platform

This is a practical, hands-on guide for running the whole stack locally and personally testing every feature as every type of user: platform Super Admin, tenant Owner/Admin/Manager/Staff, storefront Customer, and an external integration via API key.

---

## 1. First-time setup

Nothing here needs editing — every `.env.example` already has a working local default (Postgres/Redis/MinIO/MailHog credentials all match `docker-compose.yml`; Stripe is left unset on purpose and runs in a safe no-network stub mode).

```bash
# 1. Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env
cp packages/database/.env.example packages/database/.env

# 2. Start infra (Postgres, Redis, MinIO, MailHog, Prometheus, Alertmanager, Grafana)
docker compose up -d

# 3. Install dependencies (also runs `prisma generate` automatically)
pnpm install

# 4. Apply DB migrations (schema + RLS policies + the app_user DB role)
pnpm db:migrate:deploy

# 5. Seed dev data (two test tenants, their owners, a Super Admin, two plans)
pnpm db:seed

# 6. Start all three apps together (api + web + worker, one terminal)
pnpm dev
```

After that:

| Surface | URL |
|---|---|
| Web app (dashboard, storefront, admin, login) | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| **Swagger / API docs** | http://localhost:3001/api/docs |
| API health check | http://localhost:3001/health |
| MailHog (catches every email the system sends — invites, receipts, verification links) | http://localhost:8025 |
| MinIO console (uploaded images/exports live here) | http://localhost:9001 (`minioadmin` / `minioadmin`) |
| Grafana dashboards | http://localhost:3003 (anonymous, already admin) |
| Prometheus | http://localhost:9090 |

**Every email the system sends during your testing (invites, password resets, export-ready notices, dunning notices) lands in MailHog — check http://localhost:8025, not a real inbox.**

---

## 2. Seeded test accounts (ready to use immediately)

| Role | Email | Password | Tenant |
|---|---|---|---|
| Platform Super Admin | `superadmin@platform.test` | `Password123!` | none (platform-level) |
| Tenant Owner | `owner@alpha.test` | `Password123!` | Tenant Alpha (subdomain `alpha`) |
| Tenant Owner | `owner@beta.test` | `Password123!` | Tenant Beta (subdomain `beta`) |

Two separate tenants (Alpha, Beta) are seeded specifically so you can test cross-tenant isolation yourself — log in as Alpha's owner, confirm you can never see Beta's products/orders/customers, and vice versa.

**Only an Owner account exists per tenant out of the box.** There is currently no web page for inviting/managing team members (Admin/Manager/Staff) — that has to be done via a direct API call (§7 below shows exactly how). Everything else (products, orders, billing, domains, webhooks, API keys, compliance export) has a dashboard page.

---

## 3. How "which tenant am I looking at" actually works (read this before you get confused)

This system has **two completely different mechanisms** depending on which part of the app you're in:

- **Dashboard (`/dashboard/...`) and Super Admin console (`/admin/...`)**: the tenant is determined **entirely by which account you're logged in as**. There is no URL, header, or setting to switch — if you want to look at Beta's dashboard, you must log out and log back in as `owner@beta.test`. (Two browser profiles, or one regular + one incognito window, is the easiest way to have both Alpha's and Beta's dashboards open side by side.)
- **Storefront (`/[subdomain]/...`)**: the tenant is **the URL path itself**. Visit `http://localhost:3000/alpha` to shop Alpha's store, `http://localhost:3000/beta` to shop Beta's — no login needed to browse, and switching tenants is just editing the URL.

---

## 4. Testing as the Platform Super Admin

**Log in:** go to http://localhost:3000/login, email `superadmin@platform.test`, password `Password123!`. You'll land on `/dashboard` — navigate to `/admin/tenants` (there's no nav link generated for it automatically; type the URL).

**What to test:**
- `/admin/tenants` — list every tenant on the platform (you'll see Alpha and Beta, plus any you register yourself in §5-6).
- `/admin/tenants/[id]` — open a tenant's detail page:
  - Change its status (`active` → `suspended` → `offboarded`) and confirm: a suspended tenant's storefront (`/alpha`) starts refusing requests; an offboarded tenant auto-triggers a data export (visible from that tenant owner's `/dashboard/settings/compliance` page) and, if you backdate `offboardedAt` far enough, gets permanently deleted by the retention job.
  - Grant a plan override (a temporary limit bump) and confirm it shows up for that tenant.
  - Impersonate the tenant (issues you a token as if you were its owner — useful for support-style debugging).
- `/admin/plans` — create/edit/archive subscription plans (Free Trial and Pro already exist); confirm archived plans can no longer be assigned to new tenants but existing subscribers are unaffected.

---

## 5. Testing as a Tenant Owner

**Log in:** http://localhost:3000/login, `owner@alpha.test` / `Password123!`. Owners see and can do everything in `/dashboard`.

Everything below is reachable via the dashboard's left nav once logged in:

| Feature | Page | What to try |
|---|---|---|
| Products | `/dashboard/products`, `/dashboard/products/new` | Create a product with a variant; upload an image; publish it; confirm it now shows on the storefront. |
| Inventory | `/dashboard/inventory` | Adjust stock; set a low-stock threshold and watch the alert trigger. |
| Orders | `/dashboard/orders` | (Populate this by placing an order as a customer first — §8.) Update order status; issue a refund. |
| Coupons | `/dashboard/coupons`, `/dashboard/coupons/new` | Create a percentage/fixed coupon; use it at storefront checkout. |
| Shipping & Tax | `/dashboard/shipping`, `/dashboard/tax` | Configure a shipping zone/rate and a tax rule; confirm they apply at checkout. |
| Reviews | `/dashboard/reviews` | Moderate (approve/reject) a review a customer left. |
| Analytics | `/dashboard/analytics` | View revenue/orders/best-sellers dashboards; export a report. |
| Billing | `/dashboard/settings/billing` | Upgrade from Free Trial to Pro; view invoices. |
| Payments | `/dashboard/settings/payments` | Connect a (stub-mode) Stripe payment account. |
| Custom domains | `/dashboard/settings/domains` | Add a domain, see the DNS TXT verification token it gives you (won't verify without real DNS, but you can see the flow). |
| Outbound webhooks | `/dashboard/settings/webhooks` | Register an endpoint (e.g. https://webhook.site/... for a real quick test), pick event types, trigger one (create an order), watch the delivery log and signature. |
| API keys | `/dashboard/settings/api-keys` | Create a key, copy the one-time-shown value, use it with `curl -H "X-API-Key: ..."` against any endpoint instead of logging in — see §7. |
| Data export/deletion | `/dashboard/settings/compliance` | Request an export, wait a few seconds, download the generated file once it flips to "ready." |

**Team management (Admin/Manager/Staff) has no UI yet — see §7 for the API call.**

---

## 6. Testing as Admin / Manager / Staff (different permission tiers)

Since there's no invite UI, do this once via `curl` (or Swagger, see §7) logged in as the Owner, then log in normally at `/login` with the new account like anyone else.

**Permission tiers, exactly:**

| Tier | Can do |
|---|---|
| **Owner** | Everything — the only one who can change the subscription plan or request/manage data export/deletion. |
| **Admin** | Everything Owner can, **except** change the subscription plan and manage data export/deletion. |
| **Manager** | Products, inventory, orders (view/update status, not refund), customers, coupons, analytics, view-only shipping/tax/billing/settings. |
| **Staff** | View products/inventory, view/update order status, view/manage customers, view analytics — no refunds, no product editing, no settings access at all. |

**To create a Manager or Staff test login** (steps 1-3 use the Owner's token):

```bash
# 1. Log in as owner, capture the access token
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@alpha.test","password":"Password123!","subdomain":"alpha"}'
# copy tokens.accessToken from the response into $TOKEN below

# 2. List roles to get the "staff" (or "manager") role's id
curl -s http://localhost:3001/api/v1/roles \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Subdomain: alpha"
# find the role with "name":"staff" (or "manager"), copy its "id"

# 3. Invite a new user with that role
curl -s -X POST http://localhost:3001/api/v1/users/invite \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Subdomain: alpha" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff-test@alpha.test","roleId":"<paste the staff role id>"}'

# 4. Check MailHog (http://localhost:8025) for the invite email, copy the
#    accept-invite link's `token` query param out of it

# 5. Accept the invite, setting a password
curl -s -X POST http://localhost:3001/api/v1/users/accept-invite \
  -H "Content-Type: application/json" \
  -d '{"token":"<paste token from the email>","password":"StaffTest123!"}'
```

Now log in normally at http://localhost:3000/login with `staff-test@alpha.test` / `StaffTest123!` and confirm the nav/actions you'd expect for that tier (e.g. a Staff login should get a `403` trying to edit a product or issue a refund).

---

## 7. Testing via the API directly (Swagger, curl, or an API key)

**Swagger UI** (click-and-try every endpoint without writing curl): http://localhost:3001/api/docs — click "Authorize," paste an access token from any login response, and every protected route becomes callable from the browser.

**The one thing every request needs in local dev, since there's no real DNS:** a header telling the API which tenant's subdomain you mean —

```
X-Tenant-Subdomain: alpha
```
(or `beta`, or whatever subdomain you registered). Omit it entirely for platform-level calls (Super Admin login, `/plans`).

**Two ways to authenticate a request:**
- `Authorization: Bearer <accessToken>` — from any `/auth/login` or `/auth/register` response, expires in 15 minutes (use `/auth/refresh` or just log in again).
- `X-API-Key: sat_...` — from a key created at `/dashboard/settings/api-keys` (or `POST /api-keys`). No login needed, no expiry, acts as whichever user created it. **This is the "external integration" test case** — confirm you can `GET /products`, `POST /orders`, etc. with only this header and no `Authorization` header at all.

**Registering a brand-new tenant from scratch** (to test the full signup flow yourself, not just the two seeded ones):
```bash
curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"businessName":"My Test Store","subdomain":"mytest","email":"me@mytest.example","password":"TestPass123!"}'
```
Then visit `http://localhost:3000/mytest` for its storefront, or log in at `/login` for its dashboard.

---

## 8. Testing as a storefront Customer

No login needed to browse. No dashboard account needed at all — customers are a completely separate identity from staff.

1. Browse: `http://localhost:3000/alpha` → click a product → `http://localhost:3000/alpha/products/<slug>`.
2. Add to cart, go to `http://localhost:3000/alpha/cart`.
3. Register/log in as a customer at `http://localhost:3000/alpha/register` (this is a **different** login system from staff — a customer account only exists for tenant Alpha, it won't work on Beta's storefront or the staff dashboard, and vice versa).
4. Checkout at `http://localhost:3000/alpha/checkout` — apply a coupon if you made one, confirm shipping/tax calculated from what the Owner configured.
5. View order history at `http://localhost:3000/alpha/orders`.
6. Leave a review on a product you bought — then log back in as the Owner and moderate it at `/dashboard/reviews`.
7. Check MailHog for the order confirmation email.
8. Go back to the Owner's `/dashboard/orders` and confirm the order you just placed is there, and `/dashboard/inventory` shows the stock decrement.

---

## 9. Things worth knowing before you dig in

- **Rate limiting**: 100 requests/minute per IP, globally. If you're hammering the API with a test script, you'll eventually get a `429`. It resets after a minute.
- **Stripe is a stub in dev** — "connecting a payment account" and checkout's card step won't hit a real Stripe account unless you set a real `STRIPE_SECRET_KEY`. This is intentional, not a bug.
- **JWTs expire in 15 minutes** (`accessToken`) — if you've been reading this manual for a while before trying a curl example, just log in again.
- **The dashboard has no way to switch tenants** — if you need to test both Alpha and Beta's dashboards at once, use two browser sessions (e.g. a normal window + an incognito window), each logged in as a different tenant's owner.
- **There's no team-management page yet** — inviting Admin/Manager/Staff users is API-only (§6).
- Everything in this manual maps to a real, automated end-to-end test in `apps/api/test/tenant-isolation/tenant-isolation.e2e-spec.ts` — if you ever want to double-check "is this supposed to work this way," that file (and `files/06-api-specification.md`, `files/03-roles-permission-matrix.md`) is the source of truth.
