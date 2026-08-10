# Functional Requirements Document

## Multi-Tenant SaaS Commerce Platform

---

## 1. Platform / Super Admin

| ID | Requirement |
|---|---|
| FR-P-01 | Super Admin can view, search, and filter all tenants on the platform |
| FR-P-02 | Super Admin can suspend, reactivate, or offboard any tenant |
| FR-P-03 | Super Admin can view platform-wide analytics (total tenants, MRR, churn, active stores) |
| FR-P-04 | Super Admin can create, edit, and archive subscription plans |
| FR-P-05 | Super Admin can view audit logs across all tenants |
| FR-P-06 | Super Admin can impersonate a tenant admin for support purposes (with audit trail) |
| FR-P-07 | Super Admin can configure global platform settings (default plan limits, feature flags) |
| FR-P-08 | Super Admin can manually adjust a tenant's plan or grant temporary overrides |

---

## 2. Tenant Registration & Onboarding

| ID | Requirement |
|---|---|
| FR-T-01 | A visitor can register a new business account (business name, email, password) |
| FR-T-02 | System sends an email verification link on registration |
| FR-T-03 | New tenant selects a subdomain (`company.yourapp.com`) during onboarding, validated for uniqueness |
| FR-T-04 | New tenant selects a subscription plan (or starts a free trial) during onboarding |
| FR-T-05 | Tenant owner can complete store setup: store name, logo, currency, timezone, contact details |
| FR-T-06 | Tenant can request a custom domain and follow guided DNS verification steps |
| FR-T-07 | Tenant onboarding progress is tracked and resumable if interrupted |

---

## 3. Authentication & Account Management

| ID | Requirement |
|---|---|
| FR-A-01 | Users can log in with email/password |
| FR-A-02 | Users can log in via Google OAuth (optional) |
| FR-A-03 | System issues short-lived JWT access tokens and long-lived refresh tokens |
| FR-A-04 | Users can reset a forgotten password via emailed reset link |
| FR-A-05 | Users can enable two-factor authentication (TOTP) |
| FR-A-06 | Users belonging to multiple tenants can switch their active tenant context |
| FR-A-07 | Sessions can be revoked (logout from all devices) |
| FR-A-08 | Account lockout after repeated failed login attempts, with cooldown |

---

## 4. Tenant Team & Role Management

| ID | Requirement |
|---|---|
| FR-U-01 | Tenant Owner/Admin can invite staff members by email |
| FR-U-02 | Invited staff receive an email invitation with a signup/accept link |
| FR-U-03 | Tenant Owner/Admin can assign roles (Owner, Admin, Manager, Staff) to team members |
| FR-U-04 | Tenant Owner/Admin can create custom roles with configurable permission sets |
| FR-U-05 | Tenant Owner/Admin can deactivate or remove a staff member |
| FR-U-06 | Staff members can only access modules/actions permitted by their assigned role |

---

## 5. Product Catalog Management

| ID | Requirement |
|---|---|
| FR-PR-01 | Tenant can create, edit, archive, and delete products |
| FR-PR-02 | Products support multiple images, descriptions, SKU, price, and tax class |
| FR-PR-03 | Tenant can organize products into categories (nested/hierarchical) |
| FR-PR-04 | Tenant can assign brands to products |
| FR-PR-05 | Tenant can define custom attributes (e.g., material, size chart) |
| FR-PR-06 | Tenant can create product variants (e.g., size/color combinations) with independent price/SKU/stock |
| FR-PR-07 | Tenant can bulk import/export products via CSV |
| FR-PR-08 | Products can be published/unpublished (draft vs. live on storefront) |

---

## 6. Inventory Management

| ID | Requirement |
|---|---|
| FR-I-01 | Tenant can view and adjust stock levels per product/variant |
| FR-I-02 | System automatically decrements stock on order placement |
| FR-I-03 | System supports multi-warehouse/location stock tracking (Phase 6) |
| FR-I-04 | Tenant receives low-stock alerts based on configurable thresholds |
| FR-I-05 | Inventory adjustments are logged with reason codes (sale, return, damage, manual correction) |

---

## 7. Customer Management

| ID | Requirement |
|---|---|
| FR-C-01 | Storefront customers can register and log in to a tenant's store |
| FR-C-02 | Tenant can view customer profiles, order history, and lifetime value |
| FR-C-03 | Tenant can manually create or edit customer records |
| FR-C-04 | Customers can save multiple shipping addresses |
| FR-C-05 | Tenant can segment/tag customers (e.g., VIP, wholesale) |

---

## 8. Cart, Checkout & Orders

| ID | Requirement |
|---|---|
| FR-O-01 | Customers can add products/variants to a cart |
| FR-O-02 | Cart persists across sessions for logged-in customers |
| FR-O-03 | Checkout collects shipping address, shipping method, and payment details |
| FR-O-04 | System calculates taxes based on configured tax rules |
| FR-O-05 | System applies valid coupon codes at checkout |
| FR-O-06 | Orders are created with status tracking (pending, paid, fulfilled, shipped, delivered, cancelled, refunded) |
| FR-O-07 | Tenant can view, filter, and search orders |
| FR-O-08 | Tenant can manually update order status and add fulfillment tracking numbers |
| FR-O-09 | Tenant can issue full or partial refunds |
| FR-O-10 | Customers receive order confirmation and status update emails |

---

## 9. Payments

| ID | Requirement |
|---|---|
| FR-PM-01 | Tenant can connect a Stripe Connect (Express) account to accept payments |
| FR-PM-02 | Platform charges tenants for subscription plans via Stripe Billing |
| FR-PM-03 | Platform can apply a per-transaction application fee on merchant sales |
| FR-PM-04 | System handles payment webhooks idempotently (no duplicate order processing) |
| FR-PM-05 | Failed payments trigger retry logic and customer notification |
| FR-PM-06 | Tenant can view payout history and pending balances |

---

## 10. Coupons & Promotions

| ID | Requirement |
|---|---|
| FR-CP-01 | Tenant can create percentage or fixed-amount discount coupons |
| FR-CP-02 | Coupons support usage limits (total uses, per-customer uses), and expiry dates |
| FR-CP-03 | Coupons can be restricted to specific products/categories or minimum order value |

---

## 11. Shipping & Tax

| ID | Requirement |
|---|---|
| FR-S-01 | Tenant can define shipping zones and rates |
| FR-S-02 | Tenant can define flat-rate, weight-based, or free-shipping-threshold rules |
| FR-S-03 | Tenant can configure tax rules per region/product category |

---

## 12. Reviews

| ID | Requirement |
|---|---|
| FR-R-01 | Customers can leave a rating and review on purchased products |
| FR-R-02 | Tenant can moderate (approve/reject/hide) reviews |

---

## 13. Analytics & Reporting

| ID | Requirement |
|---|---|
| FR-AN-01 | Tenant dashboard shows revenue, order count, and average order value over selectable time ranges |
| FR-AN-02 | Tenant can view best-selling products and low-performing products |
| FR-AN-03 | Tenant can view customer acquisition and repeat-purchase metrics |
| FR-AN-04 | Tenant can export reports (CSV/PDF) |
| FR-AN-05 | Inventory reports show stock value, turnover, and low-stock items |

---

## 14. Notifications

| ID | Requirement |
|---|---|
| FR-N-01 | System sends transactional emails (order confirmation, shipping updates, password reset, invitations) |
| FR-N-02 | Tenant can configure which notification types are active |
| FR-N-03 | System supports in-app notifications for staff (e.g., new order, low stock) |

---

## 15. Subscription & Billing (Platform)

| ID | Requirement |
|---|---|
| FR-SB-01 | Tenant can view current plan, usage against plan limits, and upgrade/downgrade |
| FR-SB-02 | System enforces plan limits (staff seats, product count, order volume, storage) |
| FR-SB-03 | Tenant receives notifications approaching plan limits |
| FR-SB-04 | System handles failed subscription payments (dunning, grace period, suspension) |
| FR-SB-05 | Tenant can view and download billing invoices |

---

## 16. Custom Domains

| ID | Requirement |
|---|---|
| FR-D-01 | Tenant can add a custom domain and receive DNS setup instructions |
| FR-D-02 | System verifies DNS ownership before activating a custom domain |
| FR-D-03 | System automatically provisions and renews TLS certificates for verified domains |

---

## 17. Audit & Compliance

| ID | Requirement |
|---|---|
| FR-AU-01 | All sensitive actions (role changes, refunds, plan changes, data exports) are logged with actor, timestamp, and tenant context |
| FR-AU-02 | Tenant Owner/Admin can view their own tenant's audit log |
| FR-AU-03 | Tenant offboarding triggers a data export and scheduled deletion workflow |
