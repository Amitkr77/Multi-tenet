import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { createBasePrismaClient } from "@saas/database";
import {
  QUEUE_NAMES,
  BILLING_JOB_NAMES,
  EMAIL_JOB_NAMES,
  type SendAccountSuspendedEmailJob,
} from "@saas/shared-types";

/**
 * Phase 5 dunning: the grace-period-expiry check. Runs cross-tenant (finds
 * ALL tenants whose grace period has elapsed, regardless of which one), so
 * `createBasePrismaClient()` — a plain, unscoped Prisma client connecting as
 * `app_user` — is the correct tool here, same as WebhooksService's use of
 * `PrismaService.base` in apps/api: this process has no HTTP request, no
 * CLS, nothing to scope a single query to. Constructed as a field
 * initializer, mirroring EmailProcessor's own `private readonly transport =
 * createTransport()` convention (the established pattern for a worker
 * process's own top-level dependencies).
 *
 * Same job name (`BILLING_JOB_NAMES.checkPastDueTenants`) backs both the
 * recurring schedule (DunningScheduler, registered on worker boot) and a
 * one-off manual trigger — e.g. an e2e test that's just back-dated a test
 * tenant's `pastDueSince` via raw SQL and wants to deterministically prove
 * the suspension without waiting for the real interval.
 */
@Processor(QUEUE_NAMES.billing)
export class DunningProcessor extends WorkerHost {
  private readonly logger = new Logger(DunningProcessor.name);
  private readonly prisma = createBasePrismaClient(
    process.env.DATABASE_URL_APP,
  );

  constructor(
    @InjectQueue(QUEUE_NAMES.email) private readonly emailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case BILLING_JOB_NAMES.checkPastDueTenants:
        await this.checkPastDueTenants();
        break;
      default:
        this.logger.warn(`Unknown billing job name: ${job.name}`);
    }
  }

  private async checkPastDueTenants(): Promise<void> {
    const gracePeriodDays = Number(process.env.DUNNING_GRACE_PERIOD_DAYS ?? 3);
    const cutoff = new Date(Date.now() - gracePeriodDays * 24 * 60 * 60 * 1000);

    const overdue = await this.prisma.tenant.findMany({
      where: { status: "past_due", pastDueSince: { lte: cutoff } },
    });

    for (const tenant of overdue) {
      // `tenants` has no RLS policy (it IS the tenant — nothing to scope it
      // by), so its own update needs no SET LOCAL. `audit_logs` AND `users`
      // ARE RLS-protected though — both the audit-log insert and the owner
      // lookup below run inside the SAME transaction that sets
      // app.tenant_id first (hand-rolled here, not PrismaService#runScoped,
      // which doesn't exist in this process, but the identical technique
      // OrdersService's webhook-driven methods use for the same "no CLS
      // context" reason). A real bug caught during verification: the owner
      // lookup originally ran on `this.prisma` directly (no tenant context
      // set at all) — since `users` is RLS-protected, that silently
      // returned zero rows every time, so the suspension email was never
      // actually sent even though the status transition itself succeeded.
      const owner = await this.prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { status: "suspended" },
        });
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            actorUserId: null,
            action: "tenant.status_change",
            metadata: {
              from: "past_due",
              to: "suspended",
              reason: "dunning_grace_period_expired",
            },
          },
        });
        return tx.user.findFirst({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "asc" },
        });
      });

      if (owner) {
        const emailJob: SendAccountSuspendedEmailJob = {
          toEmail: owner.email,
          tenantName: tenant.name,
          billingUrl: `${process.env.WEB_APP_URL ?? "http://localhost:3000"}/dashboard/settings/billing`,
        };
        await this.emailQueue.add(
          EMAIL_JOB_NAMES.sendAccountSuspendedEmail,
          emailJob,
        );
      }

      this.logger.log(
        `Tenant ${tenant.id} (${tenant.subdomain}) suspended — dunning grace period expired.`,
      );
    }
  }
}
