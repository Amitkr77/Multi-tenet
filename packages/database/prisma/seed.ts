import * as argon2 from "argon2";
import {
  createBasePrismaClient,
  ensurePermissionCatalogue,
  ensureSuperAdminRole,
  ensureDefaultRolesForTenant,
  ensureDefaultSubscriptionForTenant,
} from "../src";

/**
 * Dev/test/CI seed data. Runs via `prisma db seed` (root: `pnpm db:seed`),
 * against DATABASE_URL — the migrator/owner Postgres role, which is a
 * superuser and therefore bypasses RLS entirely, so no SET LOCAL dance is
 * needed here (contrast with AuthService#register in apps/api, which runs as
 * the RLS-subject `app_user` role and must SET LOCAL before inserting rows
 * into RLS-protected tables — see that file for the bootstrap-exception
 * transaction).
 *
 * Seeds exactly what the tenant-isolation e2e suite (M6) and manual
 * dev/testing (M2 checkpoint, M3/M4 curl walkthroughs) need: two tenants,
 * each with an Owner user and the four default system roles, plus one
 * platform Super Admin.
 */
async function main() {
  const prisma = createBasePrismaClient();

  await ensurePermissionCatalogue(prisma);
  await ensureSuperAdminRole(prisma);

  const plan = await prisma.plan.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: { isDefault: true },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Free Trial",
      price: 0,
      billingInterval: "month",
      isDefault: true,
    },
  });
  // Generous trial limits — gating a trial on order volume isn't the point
  // of a trial, so no 'order_volume' row (unlimited) on this plan.
  await prisma.planLimit.upsert({
    where: { planId_metric: { planId: plan.id, metric: "staff_seats" } },
    update: { maxValue: 5 },
    create: { planId: plan.id, metric: "staff_seats", maxValue: 5 },
  });
  await prisma.planLimit.upsert({
    where: { planId_metric: { planId: plan.id, metric: "product_count" } },
    update: { maxValue: 50 },
    create: { planId: plan.id, metric: "product_count", maxValue: 50 },
  });

  // A second, paid plan purely so the upgrade-picker/downgrade-blocking UI
  // (Phase 5) has something real to exercise — not itself required by any
  // FR, a disclosed pragmatic addition.
  const proPlan = await prisma.plan.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Pro",
      price: 49,
      billingInterval: "month",
      isDefault: false,
    },
  });
  await prisma.planLimit.upsert({
    where: { planId_metric: { planId: proPlan.id, metric: "staff_seats" } },
    update: { maxValue: 20 },
    create: { planId: proPlan.id, metric: "staff_seats", maxValue: 20 },
  });
  await prisma.planLimit.upsert({
    where: { planId_metric: { planId: proPlan.id, metric: "product_count" } },
    update: { maxValue: 1000 },
    create: { planId: proPlan.id, metric: "product_count", maxValue: 1000 },
  });
  await prisma.planLimit.upsert({
    where: { planId_metric: { planId: proPlan.id, metric: "order_volume" } },
    update: { maxValue: 5000 },
    create: { planId: proPlan.id, metric: "order_volume", maxValue: 5000 },
  });

  const devPasswordHash = await argon2.hash("Password123!");

  const tenants = [
    { name: "Tenant Alpha", subdomain: "alpha", ownerEmail: "owner@alpha.test" },
    { name: "Tenant Beta", subdomain: "beta", ownerEmail: "owner@beta.test" },
  ];

  for (const t of tenants) {
    const tenant = await prisma.tenant.upsert({
      where: { subdomain: t.subdomain },
      update: {},
      create: {
        name: t.name,
        subdomain: t.subdomain,
        status: "active",
        currentPlanId: plan.id,
      },
    });

    const roles = await ensureDefaultRolesForTenant(prisma, tenant.id);
    await ensureDefaultSubscriptionForTenant(prisma, tenant.id, plan.id);

    const owner = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: t.ownerEmail } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: t.ownerEmail,
        passwordHash: devPasswordHash,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: owner.id, roleId: roles.owner } },
      update: {},
      create: { userId: owner.id, roleId: roles.owner, tenantId: tenant.id },
    });

    console.log(`Seeded ${t.name} (${t.subdomain}) — owner login: ${t.ownerEmail} / Password123!`);
  }

  // Nullable-field compound-unique filters aren't valid Prisma where clauses
  // (see bootstrap.ts's ensureSuperAdminRole comment) — findFirst instead.
  const superAdminRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: null, name: "super_admin" },
  });

  let superAdmin = await prisma.user.findFirst({
    where: { tenantId: null, email: "superadmin@platform.test" },
  });
  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        email: "superadmin@platform.test",
        passwordHash: devPasswordHash,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: superAdmin.id, roleId: superAdminRole.id, tenantId: null },
  });

  console.log("Seeded platform Super Admin — login: superadmin@platform.test / Password123!");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
