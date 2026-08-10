import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@saas/shared-types';
import { PaymentsModule } from '../payments/payments.module';
import { PlanLimitGuard } from '../../common/guards/plan-limit.guard';
import { BillingWebhookService } from './billing-webhook.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  // Needed for @InjectQueue(QUEUE_NAMES.email) in BillingWebhookService —
  // each module that injects a queue must register it itself (BullMQ queues
  // aren't global via BullModule.forRoot()'s Redis connection alone), same
  // pattern OrdersModule already established. PaymentsModule for StripeService
  // (BillingService#upgrade). PlanLimitGuard is ALSO a global APP_GUARD
  // (app.module.ts) — this is a second instance BillingService injects
  // directly to reuse `resolveEffectiveLimit`, same precedent as
  // CheckoutModule's own registration of it.
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.email }),
    PaymentsModule,
  ],
  controllers: [BillingController],
  providers: [BillingWebhookService, BillingService, PlanLimitGuard],
  exports: [BillingWebhookService],
})
export class BillingModule {}
