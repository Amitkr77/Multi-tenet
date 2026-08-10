import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { CouponsModule } from '../coupons/coupons.module';
import { ShippingModule } from '../shipping/shipping.module';
import { TaxModule } from '../tax/tax.module';
import { PaymentsModule } from '../payments/payments.module';
import { WebhookSubscriptionsModule } from '../webhook-subscriptions/webhook-subscriptions.module';
import { PlanLimitGuard } from '../../common/guards/plan-limit.guard';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [
    CartModule,
    CouponsModule,
    ShippingModule,
    TaxModule,
    PaymentsModule,
    WebhookSubscriptionsModule,
  ],
  controllers: [CheckoutController],
  // PlanLimitGuard is ALSO registered as a global APP_GUARD (app.module.ts)
  // for its normal @EnforcePlanLimit route-guard role — this is a second,
  // separate instance CheckoutService injects directly to reuse its
  // `resolveEffectiveLimit` method for the order_volume check, which can't
  // go through the guard itself (see checkout.service.ts's comment on why).
  // Both depend only on globally-available providers (Reflector, the
  // @Global() PrismaModule), so a second instance here is cheap and correct.
  providers: [CheckoutService, PlanLimitGuard],
})
export class CheckoutModule {}
