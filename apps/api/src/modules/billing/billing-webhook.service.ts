import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type Stripe from 'stripe';
import { EMAIL_JOB_NAMES, QUEUE_NAMES } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dispatches Stripe *Billing* events (subscription charges to tenants),
 * mirroring webhooks.controller.ts's existing `dispatchConnectEvent`
 * private-method pattern — same shape, different event-type family. Wired
 * into the already-existing `POST /webhooks/stripe/billing` route (that
 * route's signature verification + idempotency plumbing needs zero
 * changes, see WebhooksService).
 *
 * `tenantId` is trusted from the event's own metadata, same as Connect
 * events — NOT resolved via a DB lookup keyed on `stripeSubscriptionId`, a
 * real bug caught during verification: `Subscription` is RLS-protected, so
 * `prisma.base.subscription.findUnique(...)` (no tenant context set yet,
 * that's the whole problem) always returns zero rows — the exact
 * chicken-and-egg issue `Tenant`/`WebhookEvent` are deliberately
 * NOT-RLS-protected to avoid. Stripe's `Invoice.parent.subscription_details
 * .metadata` field is an immutable snapshot of the Subscription's own
 * metadata taken at invoice-finalization time (confirmed against the
 * installed stripe@22.4.0 type defs) — since `StripeService#upsertSubscription`
 * always sets `metadata: { tenantId }` on the Subscription itself, that
 * snapshot is exactly as trustworthy as Connect's per-object metadata, and
 * sidesteps the RLS problem entirely: `tenantId` is known before any query
 * runs, so the rest of this handler runs inside one ordinary
 * `prisma.runScoped(tenantId, ...)` transaction.
 */
@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.email) private readonly emailQueue: Queue,
  ) {}

  async dispatch(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'invoice.payment_failed':
        await this.handleInvoiceEvent(event, 'open');
        break;
      case 'invoice.paid':
        await this.handleInvoiceEvent(event, 'paid');
        break;
      default:
        this.logger.log(
          `Stripe billing webhook received (no handler): ${event.type} (${event.id})`,
        );
    }
  }

  private async handleInvoiceEvent(
    event: Stripe.Event,
    resultingStatus: 'open' | 'paid',
  ): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionDetails = invoice.parent?.subscription_details;
    const subscriptionRef = subscriptionDetails?.subscription ?? null;
    const stripeSubscriptionId =
      typeof subscriptionRef === 'string'
        ? subscriptionRef
        : (subscriptionRef?.id ?? null);
    const tenantId = subscriptionDetails?.metadata?.tenantId ?? null;

    if (!stripeSubscriptionId || !tenantId) {
      this.logger.warn(
        `${event.type} (${invoice.id}) missing subscription reference or tenantId metadata — ignored.`,
      );
      return;
    }

    let shouldSendPaymentFailedEmail = false;
    let tenantName = '';
    let ownerEmail: string | null = null;
    let gracePeriodEndsAt = '';

    await this.prisma.runScoped(tenantId, async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: { stripeSubscriptionId },
      });
      if (!subscription) {
        this.logger.warn(
          `${event.type} (${invoice.id}): tenant ${tenantId} has no local Subscription row for ${stripeSubscriptionId} — ignored.`,
        );
        return;
      }

      await tx.invoice.upsert({
        where: { stripeInvoiceId: invoice.id },
        create: {
          tenantId,
          subscriptionId: subscription.id,
          stripeInvoiceId: invoice.id,
          status: resultingStatus,
          amountDue: (invoice.amount_due ?? 0) / 100,
          amountPaid: (invoice.amount_paid ?? 0) / 100,
          currency: invoice.currency ?? 'usd',
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          invoicePdfUrl: invoice.invoice_pdf ?? null,
          periodStart: invoice.period_start
            ? new Date(invoice.period_start * 1000)
            : null,
          periodEnd: invoice.period_end
            ? new Date(invoice.period_end * 1000)
            : null,
        },
        update: {
          status: resultingStatus,
          amountPaid: (invoice.amount_paid ?? 0) / 100,
        },
      });

      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
      });
      tenantName = tenant.name;

      if (resultingStatus === 'open' && tenant.status === 'active') {
        const gracePeriodDays = Number(
          process.env.DUNNING_GRACE_PERIOD_DAYS ?? 3,
        );
        const gracePeriodEnd = new Date(
          Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000,
        );
        gracePeriodEndsAt = gracePeriodEnd.toISOString().slice(0, 10);

        await tx.tenant.update({
          where: { id: tenantId },
          data: { status: 'past_due', pastDueSince: new Date() },
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            actorUserId: null,
            action: 'tenant.status_change',
            metadata: {
              from: 'active',
              to: 'past_due',
              reason: 'payment_failed',
            },
          },
        });

        const owner = await tx.user.findFirst({
          where: { tenantId },
          orderBy: { createdAt: 'asc' },
        });
        ownerEmail = owner?.email ?? null;
        shouldSendPaymentFailedEmail = true;
      } else if (resultingStatus === 'paid' && tenant.status === 'past_due') {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { status: 'active', pastDueSince: null },
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            actorUserId: null,
            action: 'tenant.status_change',
            metadata: {
              from: 'past_due',
              to: 'active',
              reason: 'payment_recovered',
            },
          },
        });
        // No email here — recovery isn't dunning-worthy; the tenant already
        // knows they just paid.
      }
    });

    if (shouldSendPaymentFailedEmail && ownerEmail) {
      await this.emailQueue.add(EMAIL_JOB_NAMES.sendPaymentFailedEmail, {
        toEmail: ownerEmail,
        tenantName,
        invoiceUrl: invoice.hosted_invoice_url ?? '',
        gracePeriodEndsAt,
      });
    }
  }
}
