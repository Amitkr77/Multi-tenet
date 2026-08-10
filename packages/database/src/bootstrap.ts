import type { PrismaClient } from "@prisma/client";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, TENANT_SYSTEM_ROLES } from "./permissions";

/**
 * Idempotently seeds the global Permission catalogue. Call once at app
 * startup / seed time — not per tenant.
 */
export async function ensurePermissionCatalogue(prisma: PrismaClient) {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description },
      create: { code: p.code, description: p.description },
    });
  }
}

/**
 * Creates the four default tenant-scoped system roles (owner/admin/manager/staff)
 * with their matrix-matching permission grants for a given tenant. Called both
 * by prisma/seed.ts (dev/test tenants) and by AuthService#register (real
 * tenants at signup) so the two paths can never drift apart — 03-roles-
 * permission-matrix.md's defaults exist exactly once, here.
 *
 * Must run on a client already scoped to `tenantId` (i.e. inside the same
 * `SET LOCAL app.tenant_id` transaction that created the Tenant row — see
 * arch.md's registration bootstrap exception) since Role/RolePermission are
 * RLS-protected.
 */
export async function ensureDefaultRolesForTenant(
  prisma: Pick<PrismaClient, "role" | "rolePermission" | "permission">,
  tenantId: string,
) {
  const allPermissions = await prisma.permission.findMany();
  const byCode = new Map(allPermissions.map((p: { code: string; id: string }) => [p.code, p.id]));

  const roles: Record<string, string> = {};
  for (const roleName of TENANT_SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: roleName } },
      update: {},
      create: { tenantId, name: roleName, isSystemRole: true },
    });
    roles[roleName] = role.id;

    const grantCodes = DEFAULT_ROLE_PERMISSIONS[roleName] ?? [];
    for (const code of grantCodes) {
      const permissionId = byCode.get(code);
      if (!permissionId) continue; // catalogue not seeded yet — caller should run ensurePermissionCatalogue first
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  return roles; // { owner: roleId, admin: roleId, manager: roleId, staff: roleId }
}

/**
 * Creates the tenant's one default Warehouse row (Phase 2 — see schema.prisma's
 * comment on the Warehouse model for why this stub exists ahead of Phase 6's
 * real multi-warehouse support). Called from AuthService#register's existing
 * bootstrap transaction, right alongside ensureDefaultRolesForTenant — same
 * "must run inside the SET LOCAL app.tenant_id transaction that created the
 * Tenant row" requirement, since Warehouse is RLS-protected.
 */
export async function ensureDefaultWarehouseForTenant(
  prisma: Pick<PrismaClient, "warehouse">,
  tenantId: string,
) {
  const existing = await prisma.warehouse.findFirst({ where: { tenantId, isDefault: true } });
  if (existing) return existing;
  return prisma.warehouse.create({
    data: { tenantId, name: "Main Warehouse", isDefault: true },
  });
}

/**
 * Creates the tenant's one PaymentAccount stub row (`not_started`) — Phase 3,
 * same forward-compatible-stub move as ensureDefaultWarehouseForTenant above
 * (see schema.prisma's comment on PaymentAccount): so the Stripe Connect
 * onboarding UI never has to special-case "no row exists yet." Called from
 * AuthService#register's existing bootstrap transaction, same "must run
 * inside the SET LOCAL app.tenant_id transaction" requirement as the other
 * per-tenant bootstrap functions, since PaymentAccount is RLS-protected.
 */
export async function ensureDefaultPaymentAccountForTenant(
  prisma: Pick<PrismaClient, "paymentAccount">,
  tenantId: string,
) {
  const existing = await prisma.paymentAccount.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.paymentAccount.create({
    data: { tenantId, onboardingStatus: "not_started" },
  });
}

/**
 * Creates the tenant's one Subscription row (Phase 5) — free-plan
 * placeholder, no real Stripe customer/subscription yet (created lazily on
 * first real upgrade via StripeService#upsertSubscription). Same
 * forward-compatible-stub move as ensureDefaultWarehouseForTenant/
 * ensureDefaultPaymentAccountForTenant above. Called from
 * AuthService#register's existing bootstrap transaction, same "must run
 * inside the SET LOCAL app.tenant_id transaction" requirement, since
 * Subscription is RLS-protected. `planId` is the caller's resolved default
 * Plan id (`where: { isDefault: true }`) — passed in rather than looked up
 * here so this function stays a pure "create the row" primitive, matching
 * the other three ensureDefaultXForTenant functions' shape.
 */
export async function ensureDefaultSubscriptionForTenant(
  prisma: Pick<PrismaClient, "subscription">,
  tenantId: string,
  planId: string,
) {
  const existing = await prisma.subscription.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.subscription.create({
    data: { tenantId, planId, status: "active" },
  });
}

/**
 * Creates the single global (tenantId = null) `super_admin` role, if missing.
 * Not RLS-scoped to any tenant — call outside any tenant transaction.
 */
export async function ensureSuperAdminRole(
  prisma: Pick<PrismaClient, "role" | "rolePermission" | "permission">,
) {
  const permission = await prisma.permission.findUnique({ where: { code: "platform.super_admin" } });
  if (!permission) throw new Error("Permission catalogue not seeded — call ensurePermissionCatalogue first");

  // Prisma can't use a `null` value inside a compound-unique `where` filter
  // (@@unique([tenantId, name]), tenantId nullable) — findUnique/upsert with
  // tenantId: null in the compound key is a type error, not just a runtime
  // quirk, since a nullable column can't deterministically identify "at most
  // one row" the way a real unique key can. findFirst + conditional create
  // sidesteps it; this only runs once per environment (idempotent either way).
  let role = await prisma.role.findFirst({ where: { tenantId: null, name: "super_admin" } });
  if (!role) {
    role = await prisma.role.create({ data: { tenantId: null, name: "super_admin", isSystemRole: true } });
  }

  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    update: {},
    create: { roleId: role.id, permissionId: permission.id },
  });

  return role.id;
}
