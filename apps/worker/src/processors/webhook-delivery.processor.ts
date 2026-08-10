import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { createHmac } from "node:crypto";
import type { Job } from "bullmq";
import { createBasePrismaClient } from "@saas/database";
import {
  QUEUE_NAMES,
  WEBHOOK_DELIVERY_JOB_NAMES,
  type DeliverWebhookJob,
} from "@saas/shared-types";

const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Phase 6 — delivers one outbound webhook event to a tenant-configured
 * endpoint. Same `createBasePrismaClient()` field-initializer shape as
 * `DunningProcessor` (no HTTP/CLS context in a worker process), but unlike
 * that processor's `tenants` lookup (no RLS at all), `webhook_deliveries`/
 * `webhook_subscriptions` ARE RLS-protected — every query here runs inside
 * an explicit `SET LOCAL app.tenant_id` transaction using the `tenantId`
 * the job payload carries (see queues.ts's `DeliverWebhookJob` comment for
 * why that field exists at all).
 *
 * Retries are BullMQ's own job-level `attempts`/`backoff` (configured at
 * enqueue time by `WebhookDispatchService`) — this processor just throws on
 * a failed delivery attempt and lets BullMQ decide whether to retry. Only
 * once BullMQ has exhausted every attempt (the `failed` worker event,
 * checked via `attemptsMade >= opts.attempts`) does the `WebhookDelivery`
 * row get its terminal `failed` status — every attempt in between leaves it
 * `pending` (not a wasted intermediate `failed` write, then flipped back).
 */
@Processor(QUEUE_NAMES.webhookDelivery)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);
  private readonly prisma = createBasePrismaClient(
    process.env.DATABASE_URL_APP,
  );

  async process(job: Job<DeliverWebhookJob>): Promise<void> {
    switch (job.name) {
      case WEBHOOK_DELIVERY_JOB_NAMES.deliver:
        await this.deliver(job.data);
        break;
      default:
        this.logger.warn(`Unknown webhook-delivery job name: ${job.name}`);
    }
  }

  private async deliver({
    tenantId,
    deliveryId,
  }: DeliverWebhookJob): Promise<void> {
    const found = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      const delivery = await tx.webhookDelivery.findFirst({
        where: { id: deliveryId, tenantId },
      });
      if (!delivery) return null;
      const subscription = await tx.webhookSubscription.findFirst({
        where: { id: delivery.subscriptionId, tenantId },
      });
      return subscription ? { delivery, subscription } : null;
    });

    if (!found) {
      // Deleted subscription/delivery between enqueue and processing, or a
      // stale/malformed job — nothing to retry, same idempotent-no-op
      // discipline as OrdersService's webhook-driven methods.
      this.logger.warn(
        `WebhookDelivery ${deliveryId} (tenant ${tenantId}) or its subscription no longer exists — skipping.`,
      );
      return;
    }
    const { delivery, subscription } = found;

    const payloadString = JSON.stringify(delivery.payload);
    const signature = createHmac("sha256", subscription.secret)
      .update(payloadString)
      .digest("hex");

    let responseStatus: number;
    try {
      const response = await fetch(subscription.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": delivery.eventType,
          "X-Webhook-Delivery-Id": delivery.id,
          "X-Webhook-Signature": `sha256=${signature}`,
        },
        body: payloadString,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      responseStatus = response.status;
      if (!response.ok) {
        throw new Error(`Receiver responded ${response.status}`);
      }
    } catch (err) {
      // Record the attempt, then re-throw so BullMQ applies its own
      // backoff/retry — `status` stays `pending` here; only the `failed`
      // worker event (once retries are exhausted) sets it to `failed`.
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
        await tx.webhookDelivery.update({
          where: { id: deliveryId },
          data: { attempt: { increment: 1 } },
        });
      });
      throw err;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      await tx.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "delivered",
          responseStatus,
          attempt: { increment: 1 },
          deliveredAt: new Date(),
        },
      });
    });
  }

  @OnWorkerEvent("failed")
  async onFailed(
    job: Job<DeliverWebhookJob> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) return;
    const attemptsAllowed = job.opts.attempts ?? 1;
    if (job.attemptsMade < attemptsAllowed) return; // more retries still scheduled — not terminal yet

    const { tenantId, deliveryId } = job.data;
    this.logger.warn(
      `WebhookDelivery ${deliveryId} (tenant ${tenantId}) permanently failed after ${job.attemptsMade} attempt(s): ${error.message}`,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      await tx.webhookDelivery.updateMany({
        where: { id: deliveryId, tenantId, status: "pending" },
        data: { status: "failed" },
      });
    });
  }
}
