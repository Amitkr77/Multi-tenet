import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@saas/shared-types';
import { PaymentsModule } from '../payments/payments.module';
import { WebhookSubscriptionsModule } from '../webhook-subscriptions/webhook-subscriptions.module';
import { OrdersController } from './orders.controller';
import { StorefrontOrdersController } from './storefront-orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    PaymentsModule,
    WebhookSubscriptionsModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.email }),
  ],
  controllers: [OrdersController, StorefrontOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
