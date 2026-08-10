import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';
import { BillingModule } from '../billing/billing.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

/**
 * Depends on PaymentsModule (StripeService), OrdersModule (OrdersService),
 * and BillingModule (BillingWebhookService, Phase 5) — sits "above" all
 * three rather than any depending on another, avoiding the circular import
 * a naive "webhooks live inside payments" split would have created
 * (OrdersService.refund() also needs StripeService, i.e. Orders -> Payments
 * already; Webhooks -> all three is acyclic).
 */
@Module({
  imports: [PaymentsModule, OrdersModule, BillingModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
