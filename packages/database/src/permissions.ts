/**
 * Permission catalogue + default role grants, derived from
 * files/03-roles-permission-matrix.md §3. Single source of truth, imported
 * by both prisma/seed.ts and apps/api's tenant-registration bootstrap so a
 * seeded dev tenant and a real production-registered tenant end up with
 * identical default roles.
 *
 * Granularity note (pragmatic call for Phase 1): the matrix's per-cell C/R/U/D
 * legend is collapsed to one permission code per action-group (e.g.
 * `products.manage` covers the matrix's CRUD cluster for
 * products/categories/brands/attributes/variants/bulk-import) rather than one
 * code per CRUD letter. Cells marked "(limited)" or "(assigned only)" or
 * "(request only)" — e.g. Staff's inventory.adjust, Manager's orders.refund —
 * are granted the same code as the full-access roles; the *narrower* scoping
 * those cells describe is enforced in each module's service logic once that
 * module is built (Phase 2+), not by a separate permission code. Revisit this
 * if a module needs row-level scoping the guard alone can't express.
 */

export interface PermissionDef {
  code: string;
  description: string;
}

export const PERMISSIONS: PermissionDef[] = [
  { code: "team.manage", description: "Invite/remove staff, assign roles, create custom roles" },
  { code: "billing.view", description: "View plan & usage" },
  { code: "billing.change_plan", description: "Change subscription plan" },
  { code: "billing.view_invoices", description: "View/download billing invoices" },
  { code: "billing.connect_payment_account", description: "Connect a Stripe Connect payment account" },
  { code: "payments.view", description: "View payout history and payment transactions" },
  { code: "settings.manage", description: "Store profile/branding, custom domain setup" },
  { code: "settings.view", description: "View store settings" },
  // Phase 6 — outbound webhook subscriptions. Not folded into settings.manage
  // (which already covers custom domains) since a tenant's technical
  // integration surface is a meaningfully distinct capability from store
  // branding/profile settings, even though both sit at the same owner/admin
  // tier — same reasoning as billing.change_plan being its own code rather
  // than folded into billing.view.
  { code: "webhooks.manage", description: "Configure outbound webhook subscriptions for tenant integrations" },
  // Compliance — data export/deletion (FR-AU-03, NFR-CP-01/02). Owner-only
  // tier (see DEFAULT_ROLE_PERMISSIONS.admin below, which excludes it) —
  // same reasoning as billing.change_plan being withheld from admin: this
  // gates a destructive/high-stakes data-portability action, not ordinary
  // day-to-day store administration.
  { code: "compliance.manage", description: "Request/view the tenant's own data export" },
  // Public API — API-key authentication for tenant integrations. Owner+admin
  // tier (in ALL_TENANT_CODES, NOT excluded from admin below) — granting
  // integration access is an ordinary administrative action, same tier as
  // webhooks.manage, not a uniquely high-stakes one like billing.change_plan/
  // compliance.manage.
  { code: "api_keys.manage", description: "Create/revoke API keys for programmatic access to this tenant's data" },
  { code: "products.manage", description: "Manage products, categories, brands, attributes, variants, bulk import/export" },
  { code: "products.view", description: "View products/categories/brands" },
  { code: "inventory.view", description: "View stock levels" },
  { code: "inventory.adjust", description: "Adjust stock levels" },
  { code: "inventory.manage_alerts", description: "Configure low-stock alert thresholds" },
  { code: "orders.view", description: "View orders" },
  { code: "orders.update_status", description: "Update order status / fulfillment" },
  { code: "orders.refund", description: "Issue full/partial refunds" },
  { code: "customers.view", description: "View customer profiles" },
  { code: "customers.manage", description: "Edit customer records, segment/tag customers" },
  { code: "coupons.manage", description: "Create/edit/deactivate coupons" },
  { code: "shipping.manage", description: "Configure shipping zones/rates" },
  { code: "shipping.view", description: "View shipping zones/rates" },
  { code: "tax.manage", description: "Configure tax rules" },
  { code: "tax.view", description: "View tax rules" },
  { code: "reviews.moderate", description: "Approve/reject/hide reviews" },
  { code: "reviews.view", description: "View reviews" },
  { code: "analytics.view", description: "View analytics dashboards" },
  { code: "analytics.export", description: "Export analytics reports" },
  { code: "audit_log.view", description: "View tenant audit log" },
  { code: "notifications.manage", description: "Configure notification types" },
  { code: "platform.super_admin", description: "Platform-wide Super Admin access (all tenants, plans, global settings)" },
];

const ALL_TENANT_CODES = PERMISSIONS.filter((p) => p.code !== "platform.super_admin").map((p) => p.code);

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ALL_TENANT_CODES,
  admin: ALL_TENANT_CODES.filter((c) => c !== "billing.change_plan" && c !== "compliance.manage"),
  manager: [
    "billing.view",
    "settings.view",
    "products.manage",
    "inventory.view",
    "inventory.adjust",
    "orders.view",
    "orders.update_status",
    "customers.view",
    "customers.manage",
    "coupons.manage",
    "shipping.view",
    "tax.view",
    "reviews.moderate",
    "analytics.view",
    "analytics.export",
  ],
  staff: [
    "products.view",
    "inventory.view",
    "inventory.adjust",
    "orders.view",
    "orders.update_status",
    "customers.view",
    "customers.manage",
    "reviews.view",
    "analytics.view",
  ],
  super_admin: ["platform.super_admin"],
};

/** Tenant-scoped default roles created for every new tenant at registration. */
export const TENANT_SYSTEM_ROLES = ["owner", "admin", "manager", "staff"] as const;
