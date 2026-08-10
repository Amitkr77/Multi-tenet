import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { CheckoutRequestDto, CheckoutQuote } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanLimitGuard } from '../../common/guards/plan-limit.guard';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { ShippingService } from '../shipping/shipping.service';
import { TaxService } from '../tax/tax.service';
import { StripeService } from '../payments/stripe.service';
import { WebhookDispatchService } from '../webhook-subscriptions/webhook-dispatch.service';

interface ComputedTotals extends CheckoutQuote {
  couponId: string | null;
  cart: any;
}

/**
 * Orchestrates Cart + Coupons + Shipping + Tax + Stripe + Order creation.
 * Totals are ALWAYS recomputed server-side from the live cart/coupon/
 * shipping/tax config — the client only ever supplies a shipping address
 * and an optional coupon code, never any amount.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly couponsService: CouponsService,
    private readonly shippingService: ShippingService,
    private readonly taxService: TaxService,
    private readonly stripeService: StripeService,
    private readonly planLimitGuard: PlanLimitGuard,
    private readonly webhookDispatch: WebhookDispatchService,
  ) {}

  async quote(
    tenantId: string,
    customerId: string,
    dto: CheckoutRequestDto,
  ): Promise<CheckoutQuote> {
    const totals = await this.computeTotals(tenantId, customerId, dto);
    const { cart: _cart, couponId: _couponId, ...quote } = totals;
    return quote;
  }

  async complete(
    tenantId: string,
    customerId: string,
    dto: CheckoutRequestDto,
  ): Promise<any> {
    const totals = await this.computeTotals(tenantId, customerId, dto);
    const {
      cart,
      couponId,
      subtotal,
      taxTotal,
      shippingTotal,
      discountTotal,
      grandTotal,
    } = totals;

    const paymentAccount = await this.prisma.client.paymentAccount.findUnique({
      where: { tenantId },
    });
    if (!paymentAccount?.stripeAccountId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This store is not yet set up to accept payments.',
      });
    }

    // order_volume plan-limit check — deliberately NOT via the generic
    // PlanLimitGuard (@EnforcePlanLimit), unlike staff_seats/product_count.
    // This must be atomic with the order-creating write below (order.create
    // itself is NOT wrapped in an explicit $transaction with
    // couponRedemption.create — see this method's own comment two lines
    // down — so a guard checked before the request even reaches this
    // method could race with a concurrent checkout). The atomic Postgres
    // UPSERT on usage_counters serializes concurrent checkouts correctly
    // without a $transaction or row lock; the check runs BEFORE order.create
    // so a rejected checkout never creates a stray Order needing cleanup —
    // only the counter needs a compensating decrement.
    const orderVolumeLimit = await this.planLimitGuard.resolveEffectiveLimit(
      tenantId,
      'order_volume',
    );
    const period = new Date().toISOString().slice(0, 7); // "2026-08"
    if (orderVolumeLimit != null) {
      const counter = await this.prisma.client.usageCounter.upsert({
        where: {
          tenantId_metric_period: { tenantId, metric: 'order_volume', period },
        },
        create: { tenantId, metric: 'order_volume', period, count: 1 },
        update: { count: { increment: 1 } },
      });
      if (counter.count > orderVolumeLimit) {
        await this.prisma.client.usageCounter.update({
          where: {
            tenantId_metric_period: {
              tenantId,
              metric: 'order_volume',
              period,
            },
          },
          data: { count: { decrement: 1 } },
        });
        throw new ForbiddenException({
          code: 'PLAN_LIMIT_EXCEEDED',
          message: `You've reached your plan's monthly order limit of ${orderVolumeLimit}. Upgrade your plan to accept more orders.`,
        });
      }
    }

    // Order + OrderItems + CouponRedemption creation is one atomic
    // transaction (pure Prisma ops — the Stripe call below can't join it,
    // same "accept some non-atomicity across an external API call" trade-off
    // already established for AuthService#register's email-enqueue step).
    const order = await this.prisma.client.order.create({
      data: {
        tenantId,
        customerId,
        status: 'pending',
        subtotal,
        taxTotal,
        shippingTotal,
        discountTotal,
        grandTotal,
        couponId,
        shippingLine1: dto.shippingAddress.line1,
        shippingLine2: dto.shippingAddress.line2,
        shippingCity: dto.shippingAddress.city,
        shippingState: dto.shippingAddress.state,
        shippingPostalCode: dto.shippingAddress.postalCode,
        shippingCountry: dto.shippingAddress.country,
        items: {
          create: cart.items.map((item: any) => {
            const unitPrice = Number(
              item.variant.price ?? item.variant.product.basePrice,
            );
            return {
              tenantId,
              variantId: item.variantId,
              productName: item.variant.product.name,
              sku: item.variant.sku,
              quantity: item.quantity,
              unitPrice,
              lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
            };
          }),
        },
      },
      include: { items: true },
    });

    // Outbound webhook — fire-and-forget from the tenant's own perspective
    // (dispatch only enqueues; delivery failures never affect this request,
    // see WebhookDispatchService/WebhookDeliveryProcessor). Payload amounts
    // are plain numbers (Prisma's Decimal doesn't JSON.stringify cleanly),
    // same "Number()-convert before it leaves the API process" discipline
    // every other response in this codebase already follows for Decimal
    // fields.
    await this.webhookDispatch.dispatch(tenantId, 'order.created', {
      orderId: order.id,
      status: order.status,
      grandTotal: Number(order.grandTotal),
      currency: 'usd',
      items: order.items.map((item: any) => ({
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
      createdAt: order.createdAt,
    });

    if (couponId) {
      await this.prisma.client.couponRedemption.create({
        data: { tenantId, couponId, customerId, orderId: order.id },
      });
      await this.prisma.client.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    const applicationFeePercent = Number(
      process.env.PLATFORM_APPLICATION_FEE_PERCENT ?? 10,
    );
    const amountCents = Math.round(grandTotal * 100);
    const applicationFeeCents = Math.round(
      amountCents * (applicationFeePercent / 100),
    );

    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: amountCents,
      currency: 'usd',
      connectedAccountId: paymentAccount.stripeAccountId,
      applicationFeeAmount: applicationFeeCents,
      metadata: { tenantId, orderId: order.id },
    });

    await this.prisma.client.paymentTransaction.create({
      data: {
        tenantId,
        orderId: order.id,
        paymentAccountId: paymentAccount.id,
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
        amount: grandTotal,
        applicationFeeAmount: applicationFeeCents / 100,
      },
    });

    // Cart is cleared once the order is placed (pending payment) — checking
    // out again shouldn't re-order the same items; see this module's plan
    // Context for why decrementing INVENTORY specifically waits for payment
    // success instead (avoiding phantom stock holds from abandoned checkouts
    // is a different concern from "don't let the same cart become two orders").
    await this.prisma.client.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return { order, clientSecret: paymentIntent.client_secret };
  }

  private async computeTotals(
    tenantId: string,
    customerId: string,
    dto: CheckoutRequestDto,
  ): Promise<ComputedTotals> {
    const cart = await this.cartService.requireNonEmptyCart(
      tenantId,
      customerId,
    );

    const subtotal = cart.items.reduce((sum: number, item: any) => {
      const unitPrice = Number(
        item.variant.price ?? item.variant.product.basePrice,
      );
      return sum + unitPrice * item.quantity;
    }, 0);

    const cartProductIds: string[] = [
      ...new Set<string>(
        cart.items.map((i: any) => i.variant.productId as string),
      ),
    ];
    const cartCategoryIds: string[] = [
      ...new Set<string>(
        cart.items
          .map((i: any) => i.variant.product.categoryId as string | null)
          .filter((id: string | null): id is string => !!id),
      ),
    ];

    const shippingQuote = await this.shippingService.calculateShippingCost(
      tenantId,
      dto.shippingAddress,
      subtotal,
    );
    const shippingTotal = shippingQuote?.amount ?? 0;

    const taxTotal = await this.taxService.calculateTax(
      tenantId,
      dto.shippingAddress,
      subtotal,
      cartCategoryIds,
    );

    let discountTotal = 0;
    let couponId: string | null = null;
    if (dto.couponCode) {
      const resolved = await this.couponsService.resolveForCheckout(
        tenantId,
        dto.couponCode,
        customerId,
        subtotal,
        cartProductIds,
        cartCategoryIds,
      );
      discountTotal = resolved.discountAmount;
      couponId = resolved.couponId;
    }

    const grandTotal = Math.max(
      0,
      Math.round((subtotal - discountTotal + taxTotal + shippingTotal) * 100) /
        100,
    );

    return {
      cart,
      couponId,
      subtotal,
      taxTotal,
      shippingTotal,
      discountTotal,
      grandTotal,
    };
  }
}
