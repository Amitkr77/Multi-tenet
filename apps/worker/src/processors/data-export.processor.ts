import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { Job } from "bullmq";
import { createBasePrismaClient } from "@saas/database";
import {
  QUEUE_NAMES,
  COMPLIANCE_JOB_NAMES,
  EMAIL_JOB_NAMES,
  type GenerateExportJob,
  type SendDataExportReadyEmailJob,
} from "@saas/shared-types";
import { putObject, getPresignedDownloadUrl } from "../storage-client";

const DOWNLOAD_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Phase 6-adjacent (compliance) — builds one JSON document of a tenant's
 * real business data (FR-AU-03/NFR-CP-01) and uploads it to storage. Same
 * `createBasePrismaClient()` field-initializer + `SET LOCAL app.tenant_id`
 * shape as every other worker processor touching RLS-protected tables
 * (DunningProcessor, WebhookDeliveryProcessor).
 *
 * Deliberately excludes: `passwordHash` (both User and Customer — select
 * lists every other field explicitly, so it's structurally impossible for
 * this to regress and leak a hash), `WebhookSubscription.secret` (same
 * reasoning as `WebhookSubscriptionsService#omitSecret`), and whole tables
 * that aren't the tenant's own portable business data — `AuditLog`,
 * `WebhookDelivery`, `InventoryAdjustment`, `UsageCounter` (high-volume
 * internal/operational logs) and `Session`/`CustomerSession`/
 * `VerificationToken` (security tokens, actively harmful to export) — a
 * disclosed scope decision from this feature's plan, not an oversight.
 */
@Processor(QUEUE_NAMES.dataExport)
export class DataExportProcessor extends WorkerHost {
  private readonly logger = new Logger(DataExportProcessor.name);
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
      case COMPLIANCE_JOB_NAMES.generateExport:
        await this.generateExport(job.data as GenerateExportJob);
        break;
      default:
        this.logger.warn(`Unknown data-export job name: ${job.name}`);
    }
  }

  private async generateExport({
    tenantId,
    exportRequestId,
  }: GenerateExportJob): Promise<void> {
    try {
      const data = await this.collectTenantData(tenantId);
      const key = `tenants/${tenantId}/exports/${exportRequestId}.json`;
      await putObject(key, JSON.stringify(data, null, 2), "application/json");

      const downloadUrl = await getPresignedDownloadUrl(
        key,
        DOWNLOAD_URL_EXPIRY_SECONDS,
      );
      const expiresAt = new Date(
        Date.now() + DOWNLOAD_URL_EXPIRY_SECONDS * 1000,
      );

      const { tenantName, ownerEmail } = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
          await tx.dataExportRequest.update({
            where: { id: exportRequestId },
            data: {
              status: "ready",
              downloadUrl,
              expiresAt,
              readyAt: new Date(),
            },
          });
          const tenant = await tx.tenant.findUniqueOrThrow({
            where: { id: tenantId },
          });
          const owner = await tx.user.findFirst({
            where: { tenantId },
            orderBy: { createdAt: "asc" },
          });
          return { tenantName: tenant.name, ownerEmail: owner?.email ?? null };
        },
      );

      if (ownerEmail) {
        const emailJob: SendDataExportReadyEmailJob = {
          toEmail: ownerEmail,
          tenantName,
          downloadUrl,
          expiresAt: expiresAt.toISOString(),
        };
        await this.emailQueue.add(
          EMAIL_JOB_NAMES.sendDataExportReadyEmail,
          emailJob,
        );
      }

      this.logger.log(
        `Data export ${exportRequestId} (tenant ${tenantId}) ready.`,
      );
    } catch (err) {
      this.logger.error(
        `Data export ${exportRequestId} (tenant ${tenantId}) failed: ${(err as Error).message}`,
      );
      await this.prisma
        .$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
          await tx.dataExportRequest.update({
            where: { id: exportRequestId },
            data: { status: "failed" },
          });
        })
        .catch(() => undefined); // best-effort — don't mask the original error with a second one
      throw err; // let BullMQ record the failure too
    }
  }

  /**
   * One `SET LOCAL app.tenant_id` transaction, every query run inside it —
   * same discipline as every other cross-table worker read in this
   * codebase. Field lists are explicit (not `include: true`-style
   * catch-alls) specifically to keep `passwordHash`/`secret` structurally
   * unreachable, not just conventionally omitted.
   */
  private async collectTenantData(tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

      const [
        tenant,
        users,
        roles,
        categories,
        brands,
        products,
        customers,
        orders,
        coupons,
        reviews,
        shippingZones,
        taxRules,
        subscription,
        invoices,
        customDomains,
        webhookSubscriptions,
      ] = await Promise.all([
        tx.tenant.findUniqueOrThrow({
          where: { id: tenantId },
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true,
            currency: true,
            timezone: true,
            createdAt: true,
          },
        }),
        tx.user.findMany({
          where: { tenantId },
          select: {
            id: true,
            email: true,
            twoFactorEnabled: true,
            isActive: true,
            emailVerifiedAt: true,
            createdAt: true,
          },
        }),
        tx.role.findMany({ where: { tenantId } }),
        tx.category.findMany({ where: { tenantId } }),
        tx.brand.findMany({ where: { tenantId } }),
        tx.product.findMany({
          where: { tenantId },
          include: {
            images: true,
            variants: { include: { inventory: true } },
            attributeValues: { include: { attribute: true } },
          },
        }),
        tx.customer.findMany({
          where: { tenantId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            tags: true,
            emailVerifiedAt: true,
            isActive: true,
            createdAt: true,
            addresses: true,
          },
        }),
        tx.order.findMany({
          where: { tenantId },
          include: { items: true, paymentTransactions: true, refunds: true },
        }),
        tx.coupon.findMany({ where: { tenantId } }),
        tx.review.findMany({ where: { tenantId } }),
        tx.shippingZone.findMany({
          where: { tenantId },
          include: { rates: true },
        }),
        tx.taxRule.findMany({ where: { tenantId } }),
        tx.subscription.findUnique({
          where: { tenantId },
          include: { plan: true },
        }),
        tx.invoice.findMany({ where: { tenantId } }),
        tx.customDomain.findMany({ where: { tenantId } }),
        tx.webhookSubscription.findMany({
          where: { tenantId },
          select: {
            id: true,
            url: true,
            eventTypes: true,
            isActive: true,
            createdAt: true,
          }, // `secret` deliberately never selected
        }),
      ]);

      return {
        exportedAt: new Date().toISOString(),
        tenant,
        users,
        roles,
        categories,
        brands,
        products,
        customers,
        orders,
        coupons,
        reviews,
        shippingZones,
        taxRules,
        subscription,
        invoices,
        customDomains,
        webhookSubscriptions,
      };
    });
  }
}
