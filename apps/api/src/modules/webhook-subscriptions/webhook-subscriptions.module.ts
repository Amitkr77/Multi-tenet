import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@saas/shared-types';
import { WebhookSubscriptionsController } from './webhook-subscriptions.controller';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service';
import { WebhookDispatchService } from './webhook-dispatch.service';

/**
 * `WebhookDispatchService` is exported (not just `WebhookSubscriptionsService`)
 * so `CheckoutModule`/`OrdersModule`/`ProductsModule` can import this module
 * and inject it directly at the point of the state change — same shape as
 * `PaymentsModule` exporting `StripeService` for other modules to consume.
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.webhookDelivery })],
  controllers: [WebhookSubscriptionsController],
  providers: [WebhookSubscriptionsService, WebhookDispatchService],
  exports: [WebhookDispatchService],
})
export class WebhookSubscriptionsModule {}
