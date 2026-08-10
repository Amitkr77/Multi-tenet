import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../payments/stripe.service';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * Signature verification + idempotent insert-or-skip (FR-PM-04 / NFR-AV-03),
 * kept separate from the actual per-event-type business logic so the
 * idempotency guarantee itself can be proven in isolation (M18's checkpoint:
 * send the same signed event twice, assert it's processed exactly once)
 * before Orders/Checkout (M19) give it anything real to do.
 *
 * Writes WebhookEvent via `PrismaService.base` — this table is NOT
 * RLS-protected (see schema.prisma's comment on WebhookEvent) because a
 * webhook arrives with no authenticated tenant context at all.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Verifies the signature, then atomically claims the event via the
   * `@@unique([source, eventId])` constraint — the INSERT itself IS the
   * idempotency check: a second delivery of the same event.id collides on
   * that constraint and is skipped without ever reaching the handler below.
   */
  async process(
    rawBody: Buffer | string,
    signature: string | undefined,
    handler: (event: Stripe.Event) => Promise<void>,
  ): Promise<{ received: true; duplicate: boolean }> {
    if (!signature) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Missing Stripe-Signature header.',
      });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Webhook secret not configured.',
      });
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Invalid webhook signature: ${(err as Error).message}`,
      });
    }

    try {
      await this.prisma.base.webhookEvent.create({
        data: { source: 'stripe', eventId: event.id, processed: false },
      });
    } catch (err: any) {
      if (err?.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION) {
        this.logger.log(
          `Duplicate Stripe webhook delivery skipped: ${event.id} (${event.type})`,
        );
        return { received: true, duplicate: true };
      }
      throw err;
    }

    await handler(event);

    await this.prisma.base.webhookEvent.updateMany({
      where: { source: 'stripe', eventId: event.id },
      data: { processed: true },
    });

    return { received: true, duplicate: false };
  }
}
