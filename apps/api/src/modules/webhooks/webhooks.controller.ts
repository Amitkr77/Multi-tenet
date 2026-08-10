import { Controller, Headers, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { Public } from '../../common/decorators/public.decorator';
import { OrdersService } from '../orders/orders.service';
import { BillingWebhookService } from '../billing/billing-webhook.service';
import { WebhooksService } from './webhooks.service';

/**
 * Stripe calls these directly — no JWT, no tenant header, no CLS. `@Public()`
 * skips the staff JwtAuthGuard; TenantResolverGuard also runs but resolves
 * `request.tenantId = null` here (no Host-header subdomain match), which is
 * fine — WebhooksService writes via PrismaService.base, outside tenant scope
 * entirely, matching WebhookEvent's own not-RLS-protected design. Any
 * tenant-scoped work the handlers below do (marking an Order paid/refunded,
 * decrementing/restocking inventory) goes through OrdersService's explicit
 * `runScoped`-based methods, not CLS — see orders.service.ts's file comment.
 */
@ApiExcludeController()
@Controller('webhooks/stripe')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly ordersService: OrdersService,
    private readonly billingWebhookService: BillingWebhookService,
  ) {}

  @Public()
  @Post('connect')
  async handleConnectWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.webhooksService.process(req.rawBody ?? '', signature, (event) =>
      this.dispatchConnectEvent(event),
    );
  }

  @Public()
  @Post('billing')
  async handleBillingWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.webhooksService.process(req.rawBody ?? '', signature, (event) =>
      this.billingWebhookService.dispatch(event),
    );
  }

  /**
   * `tenantId`/`orderId`/`refundId` always come from the event object's own
   * `metadata` (set at creation time in CheckoutService/OrdersService#refund)
   * — never trusted from anywhere else, since this endpoint has no
   * authenticated context to derive them from otherwise.
   */
  private async dispatchConnectEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { tenantId, orderId } = pi.metadata ?? {};
        if (!tenantId || !orderId) {
          this.logger.warn(
            `payment_intent.succeeded (${pi.id}) missing tenantId/orderId metadata — ignored.`,
          );
          return;
        }
        await this.ordersService.markPaidFromWebhook(tenantId, orderId, pi.id);
        break;
      }
      // A standalone Refund resource event (distinct from charge.refunded) —
      // carries the metadata set on the Refund itself at creation time,
      // which a Charge-level event would not reliably inherit.
      case 'refund.updated': {
        const refund = event.data.object as Stripe.Refund;
        const { tenantId, refundId } = refund.metadata ?? {};
        if (refund.status !== 'succeeded') break;
        if (!tenantId || !refundId) {
          this.logger.warn(
            `refund.updated (${refund.id}) missing tenantId/refundId metadata — ignored.`,
          );
          return;
        }
        await this.ordersService.confirmRefundFromWebhook(tenantId, refundId);
        break;
      }
      default:
        this.logger.log(
          `Stripe connect webhook received (no handler): ${event.type} (${event.id})`,
        );
    }
  }
}
