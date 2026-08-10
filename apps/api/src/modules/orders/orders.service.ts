import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  QUEUE_NAMES,
  EMAIL_JOB_NAMES,
  type SendOrderConfirmationEmailJob,
} from '@saas/shared-types';
import type { UpdateOrderStatusDto, RefundOrderDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../payments/stripe.service';
import { WebhookDispatchService } from '../webhook-subscriptions/webhook-dispatch.service';

const ORDER_INCLUDE = {
  items: true,
  paymentTransactions: true,
  refunds: true,
  customer: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
};

/**
 * Staff-facing methods (list/getById/updateStatus/refund) run through the
 * normal authenticated pipeline — `this.prisma.client` (CLS-backed) is
 * correct, same as every other Phase 2/3 module.
 *
 * The webhook-driven completion methods (markPaidFromWebhook,
 * confirmRefundFromWebhook) are a bootstrap exception, same class of problem
 * as AuthService#register/login: a Stripe webhook arrives with no CLS tenant
 * context at all (no JWT, no resolved Host-header tenant), so they take an
 * explicit `tenantId` (read from the PaymentIntent/Refund's own `metadata`
 * by the webhook handler, not trusted from request headers) and use
 * `PrismaService.runScoped` directly rather than relying on CLS. This is
 * also why they can't just call InventoryService.adjust (CLS-based) — the
 * inventory decrement/restock is done inline, in the SAME transaction as the
 * Order/PaymentTransaction update, which is more correct anyway (atomic).
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly webhookDispatch: WebhookDispatchService,
    @InjectQueue(QUEUE_NAMES.email) private readonly emailQueue: Queue,
  ) {}

  list(
    tenantId: string,
    filters: { status?: string; search?: string },
  ): Promise<any> {
    return this.prisma.client.order.findMany({
      where: {
        tenantId,
        status: filters.status as any,
        customer: filters.search
          ? { email: { contains: filters.search, mode: 'insensitive' } }
          : undefined,
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(tenantId: string, id: string): Promise<any> {
    const order = await this.prisma.client.order.findFirst({
      where: { id, tenantId },
      include: ORDER_INCLUDE,
    });
    if (!order)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Order not found.',
      });
    return order;
  }

  async getOwnedByCustomer(
    tenantId: string,
    customerId: string,
    id: string,
  ): Promise<any> {
    const order = await this.prisma.client.order.findFirst({
      where: { id, tenantId, customerId },
      include: ORDER_INCLUDE,
    });
    if (!order)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Order not found.',
      });
    return order;
  }

  listForCustomer(tenantId: string, customerId: string): Promise<any> {
    return this.prisma.client.order.findMany({
      where: { tenantId, customerId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdateOrderStatusDto,
  ): Promise<any> {
    const existing = await this.getById(tenantId, id);
    await this.prisma.client.order.update({ where: { id }, data: dto });
    const updated = await this.getById(tenantId, id);

    if (dto.status && dto.status !== existing.status) {
      await this.webhookDispatch.dispatch(tenantId, 'order.status_changed', {
        orderId: id,
        from: existing.status,
        to: dto.status,
        trackingNumber: updated.trackingNumber,
        fulfillmentCarrier: updated.fulfillmentCarrier,
      });
    }

    return updated;
  }

  /**
   * Staff-initiated — runs through the normal pipeline (CLS is correctly
   * populated here, unlike the webhook path). Creates the Stripe refund and
   * a `pending` Refund row; confirmation (and the actual inventory restock)
   * happens asynchronously via `confirmRefundFromWebhook` once Stripe
   * confirms it, matching how the purchase side works (payment succeeds via
   * webhook, not synchronously in the request that created the PaymentIntent).
   */
  async refund(
    tenantId: string,
    orderId: string,
    dto: RefundOrderDto,
    actorUserId: string,
  ): Promise<any> {
    const order = await this.getById(tenantId, orderId);
    if (
      order.status !== 'paid' &&
      order.status !== 'fulfilled' &&
      order.status !== 'shipped' &&
      order.status !== 'delivered'
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Cannot refund an order with status "${order.status}".`,
      });
    }
    const transaction = order.paymentTransactions.find(
      (t: any) => t.status === 'succeeded',
    );
    if (!transaction) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No succeeded payment found for this order.',
      });
    }

    const alreadyRefunded = order.refunds
      .filter((r: any) => r.status === 'succeeded')
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0);
    const remaining = Number(transaction.amount) - alreadyRefunded;
    const amount = dto.amount ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Refund amount must be between $0.01 and $${remaining.toFixed(2)} (already refunded: $${alreadyRefunded.toFixed(2)}).`,
      });
    }

    const refund = await this.prisma.client.refund.create({
      data: {
        tenantId,
        orderId,
        paymentTransactionId: transaction.id,
        amount,
        reason: dto.reason,
        status: 'pending',
        actorUserId,
      },
    });

    const stripeRefund = await this.stripeService.createRefund({
      paymentIntentId: transaction.stripePaymentIntentId,
      amount: Math.round(amount * 100),
      metadata: { tenantId, orderId, refundId: refund.id },
    });

    return this.prisma.client.refund.update({
      where: { id: refund.id },
      data: { stripeRefundId: stripeRefund.id },
    });
  }

  /**
   * Called by WebhooksController on `payment_intent.succeeded`. `tenantId`
   * comes from the PaymentIntent's own metadata (set at creation in
   * CheckoutService), never trusted from anywhere else.
   */
  async markPaidFromWebhook(
    tenantId: string,
    orderId: string,
    stripePaymentIntentId: string,
  ): Promise<void> {
    await this.prisma.runScoped(tenantId, async (tx) => {
      const transaction = await tx.paymentTransaction.findFirst({
        where: { stripePaymentIntentId, tenantId },
      });
      if (!transaction || transaction.status === 'succeeded') return; // already processed or unknown — idempotent no-op

      const previousStatus = (
        await tx.order.findUniqueOrThrow({ where: { id: orderId } })
      ).status;

      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'succeeded' },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'paid' },
      });
      await this.webhookDispatch.dispatch(tenantId, 'order.status_changed', {
        orderId,
        from: previousStatus,
        to: 'paid',
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true, customer: true },
      });

      // Decrement inventory (reason: sale) — inline, not via
      // InventoryService (CLS-based, unsafe from a webhook context). Best-
      // effort per line: a variant deleted since the order was placed has no
      // inventory row to decrement (OrderItem.variantId is nullable/SetNull
      // for exactly this reason) — skip rather than fail the whole webhook.
      for (const item of order.items) {
        if (!item.variantId) continue;
        const inventory = await tx.inventory.findFirst({
          where: { variantId: item.variantId, tenantId },
        });
        if (!inventory) continue;
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantityOnHand: Math.max(
              0,
              inventory.quantityOnHand - item.quantity,
            ),
          },
        });
        await tx.inventoryAdjustment.create({
          data: {
            tenantId,
            inventoryId: inventory.id,
            delta: -item.quantity,
            reasonCode: 'sale',
            note: `Order ${orderId}`,
          },
        });
      }

      if (order.customer.email) {
        const tenant = await tx.tenant.findUniqueOrThrow({
          where: { id: tenantId },
        });
        const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:3000';
        const job: SendOrderConfirmationEmailJob = {
          toEmail: order.customer.email,
          orderId: order.id,
          tenantName: tenant.name,
          grandTotal: Number(order.grandTotal),
          orderUrl: `${webAppUrl}/${tenant.subdomain}/orders/${order.id}`,
        };
        await this.emailQueue.add(
          EMAIL_JOB_NAMES.sendOrderConfirmationEmail,
          job,
        );
      }
    });
  }

  /**
   * Called by WebhooksController on a refund-confirmation event.
   * `tenantId`/`refundId` come from the Refund's own metadata (set at
   * creation in `refund()` above).
   */
  async confirmRefundFromWebhook(
    tenantId: string,
    refundId: string,
  ): Promise<void> {
    await this.prisma.runScoped(tenantId, async (tx) => {
      const refund = await tx.refund.findFirst({
        where: { id: refundId, tenantId },
      });
      if (!refund || refund.status === 'succeeded') return; // already processed or unknown — idempotent no-op

      await tx.refund.update({
        where: { id: refund.id },
        data: { status: 'succeeded' },
      });

      const transaction = await tx.paymentTransaction.findUniqueOrThrow({
        where: { id: refund.paymentTransactionId },
      });
      const totalRefunded = await tx.refund.aggregate({
        where: { paymentTransactionId: transaction.id, status: 'succeeded' },
        _sum: { amount: true },
      });
      const isFullyRefunded =
        Number(totalRefunded._sum.amount ?? 0) >= Number(transaction.amount);
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: isFullyRefunded ? 'refunded' : 'partially_refunded' },
      });
      await tx.order.update({
        where: { id: refund.orderId },
        data: { status: isFullyRefunded ? 'refunded' : undefined },
      });

      // Restock (reason: return) — same inline-not-via-InventoryService
      // rationale as markPaidFromWebhook. Refund amount doesn't map cleanly
      // to specific line items/quantities for a partial refund, so this
      // phase restocks the full order's items only on a FULLY refunded
      // order — a partial refund's inventory effect is a manual
      // reconciliation task for the tenant, not automated here.
      if (isFullyRefunded) {
        const order = await tx.order.findUniqueOrThrow({
          where: { id: refund.orderId },
          include: { items: true },
        });
        for (const item of order.items) {
          if (!item.variantId) continue;
          const inventory = await tx.inventory.findFirst({
            where: { variantId: item.variantId, tenantId },
          });
          if (!inventory) continue;
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantityOnHand: inventory.quantityOnHand + item.quantity },
          });
          await tx.inventoryAdjustment.create({
            data: {
              tenantId,
              inventoryId: inventory.id,
              delta: item.quantity,
              reasonCode: 'return',
              note: `Refund ${refund.id} for order ${refund.orderId}`,
            },
          });
        }
      }
    });
  }
}
