import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { createBasePrismaClient } from "@saas/database";
import {
  QUEUE_NAMES,
  COMPLIANCE_JOB_NAMES,
  EMAIL_JOB_NAMES,
  type SendDataDeletedEmailJob,
} from "@saas/shared-types";

/**
 * FR-AU-03/NFR-CP-02 — the retention-expiry check. Runs cross-tenant (finds
 * ALL offboarded tenants past their retention window), so
 * `createBasePrismaClient()` is the correct tool, same shape as
 * `DunningProcessor`. Same job name backs both the recurring schedule
 * (`DataRetentionSchedulerService`) and a one-off manual trigger (e2e tests
 * that back-date `offboardedAt` via raw SQL).
 *
 * `prisma.tenant.delete()` is used directly — proven empirically (a real
 * psql test, not just Postgres documentation) that a cascade delete
 * bypasses RLS entirely regardless of the deleting connection's tenant
 * context, so no special superuser connection or explicit multi-table
 * delete is needed (see this feature's plan for the full verification).
 * Every tenant-scoped table cascades via `onDelete: Cascade` (confirmed
 * during planning against every migration's actual SQL) — one call purges
 * everything: users, products, orders, customers, all of it.
 */
@Processor(QUEUE_NAMES.dataRetention)
export class DataRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(DataRetentionProcessor.name);
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
      case COMPLIANCE_JOB_NAMES.checkRetentionDeletes:
        await this.checkRetentionDeletes();
        break;
      default:
        this.logger.warn(`Unknown data-retention job name: ${job.name}`);
    }
  }

  private async checkRetentionDeletes(): Promise<void> {
    const retentionDays = Number(process.env.DATA_RETENTION_DAYS ?? 30);
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const overdue = await this.prisma.tenant.findMany({
      where: { status: "offboarded", offboardedAt: { lte: cutoff } },
    });

    for (const tenant of overdue) {
      // `users` IS RLS-protected — the owner lookup needs SET LOCAL, same
      // "no CLS context" reason as DunningProcessor's identical owner
      // lookup. Captured BEFORE the delete: once the tenant (and its
      // cascaded Users) are gone, there is nothing left to look up.
      const owner = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
        return tx.user.findFirst({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "asc" },
        });
      });

      await this.prisma.tenant.delete({ where: { id: tenant.id } });

      if (owner) {
        const emailJob: SendDataDeletedEmailJob = {
          toEmail: owner.email,
          tenantName: tenant.name,
        };
        await this.emailQueue.add(
          EMAIL_JOB_NAMES.sendDataDeletedEmail,
          emailJob,
        );
      }

      this.logger.log(
        `Tenant ${tenant.id} (${tenant.subdomain}) permanently deleted — retention period elapsed.`,
      );
    }
  }
}
