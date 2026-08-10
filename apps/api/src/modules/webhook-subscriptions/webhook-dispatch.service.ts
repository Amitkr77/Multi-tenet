import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  QUEUE_NAMES,
  WEBHOOK_DELIVERY_JOB_NAMES,
  type DeliverWebhookJob,
  type WebhookEventType,
} from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Called directly from the point of the state change (CheckoutService,
 * OrdersService, ProductsService) — a plain method call into a queue,
 * exactly like `OrdersService` already enqueues `sendOrderConfirmationEmail`
 * inline at the point of payment success. No event-emitter abstraction:
 * this codebase has never used one (confirmed during Phase 6 planning — no
 * `@nestjs/event-emitter` anywhere), so introducing one here for a single
 * feature would be a new architectural primitive nothing else follows.
 *
 * Uses `prisma.runScoped`, NOT `prisma.client` — most call sites
 * (CheckoutService, ProductsService, OrdersService#updateStatus) run at the
 * normal HANDLER phase with CLS already populated, where `prisma.client`
 * would also work, but `OrdersService#markPaidFromWebhook` calls this from
 * a genuine no-CLS webhook context (no resolved Host-header tenant, no
 * JWT — see that method's own file comment), where `prisma.client` would
 * silently operate with no tenant scope at all. `runScoped` is correct in
 * BOTH cases (redundant-but-harmless extra `SET LOCAL` in the handler-phase
 * case) — same precedent as `PlanLimitGuard#resolveEffectiveLimit`.
 */
@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.webhookDelivery)
    private readonly webhookQueue: Queue,
  ) {}

  /**
   * Finds every active subscription for this tenant that's opted into
   * `eventType`, creates one `WebhookDelivery` row per match (status
   * `pending`), and enqueues one delivery job per row. A tenant with zero
   * matching subscriptions is the overwhelmingly common case (most tenants
   * never configure any) — a no-op, not an error.
   */
  async dispatch(
    tenantId: string,
    eventType: WebhookEventType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const deliveryIds = await this.prisma.runScoped(tenantId, async (tx) => {
      const subscriptions = await tx.webhookSubscription.findMany({
        where: { tenantId, isActive: true, eventTypes: { has: eventType } },
      });
      const ids: string[] = [];
      for (const subscription of subscriptions) {
        const delivery = await tx.webhookDelivery.create({
          data: {
            tenantId,
            subscriptionId: subscription.id,
            eventType,
            payload: payload as any,
          },
        });
        ids.push(delivery.id);
      }
      return ids;
    });
    if (deliveryIds.length === 0) return;

    for (const deliveryId of deliveryIds) {
      const job: DeliverWebhookJob = { tenantId, deliveryId };
      await this.webhookQueue.add(WEBHOOK_DELIVERY_JOB_NAMES.deliver, job, {
        // BullMQ's own retry/backoff — no hand-rolled retry loop. 5 attempts,
        // exponential backoff starting at 5s (5s, 10s, 20s, 40s, 80s) covers
        // a receiver having a brief outage without hammering it.
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
      });
    }

    this.logger.debug(
      `Dispatched ${eventType} to ${deliveryIds.length} webhook subscription(s) for tenant ${tenantId}.`,
    );
  }
}
