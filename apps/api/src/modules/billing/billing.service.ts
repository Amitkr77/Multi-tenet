import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UpgradePlanDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanLimitGuard } from '../../common/guards/plan-limit.guard';
import { StripeService } from '../payments/stripe.service';

const ENFORCED_METRICS = ['staff_seats', 'product_count', 'order_volume'];
// Only these two are live-COUNT metrics a downgrade could immediately
// violate today (order_volume resets monthly, so a downgrade never retroactively
// breaks a past month's already-recorded usage).
const DOWNGRADE_CHECKED_METRICS = ['staff_seats', 'product_count'];

/**
 * Runs at the normal HANDLER phase (called from BillingController's route
 * methods), where CLS is already populated by TenantContextInterceptor —
 * unlike PlanLimitGuard, which runs during the GUARD phase and must use
 * `runScoped` explicitly for that reason. `prisma.client` is correctly
 * tenant-scoped here. `Plan`/`PlanLimit` reads use `prisma.base` instead —
 * platform-level config, not tenant data, same convention as PlansService.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimitGuard: PlanLimitGuard,
    private readonly stripeService: StripeService,
  ) {}

  async getCurrentPlanAndUsage(tenantId: string): Promise<any> {
    const subscription = await this.prisma.client.subscription.findUnique({
      where: { tenantId },
      include: { plan: { include: { limits: true } } },
    });
    if (!subscription) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'No subscription found for this tenant.',
      });
    }

    const usage = await Promise.all(
      ENFORCED_METRICS.map(async (metric) => ({
        metric,
        limit: await this.planLimitGuard.resolveEffectiveLimit(
          tenantId,
          metric,
        ),
        count: await this.currentUsage(tenantId, metric),
      })),
    );

    return { plan: subscription.plan, subscription, usage };
  }

  async listInvoices(tenantId: string): Promise<any> {
    return this.prisma.client.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upgrade(
    tenantId: string,
    dto: UpgradePlanDto,
    _actorUserId: string,
  ): Promise<any> {
    const targetPlan = await this.prisma.base.plan.findUnique({
      where: { id: dto.planId },
      include: { limits: true },
    });
    if (!targetPlan || targetPlan.archivedAt) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Plan not found or no longer available.',
      });
    }

    // Downgrade-blocking: reject if current usage already exceeds the
    // TARGET plan's limits (ignoring active overrides deliberately — an
    // override is tenant-specific and temporary, shouldn't silently let a
    // downgrade past a limit the new plan itself doesn't support).
    for (const limit of targetPlan.limits) {
      if (!DOWNGRADE_CHECKED_METRICS.includes(limit.metric)) continue;
      const count = await this.currentUsage(tenantId, limit.metric);
      if (count > limit.maxValue) {
        throw new BadRequestException({
          code: 'DOWNGRADE_BLOCKED',
          message: `Your current ${limit.metric.replace('_', ' ')} usage (${count}) exceeds the target plan's limit of ${limit.maxValue}. Reduce usage before downgrading.`,
        });
      }
    }

    const subscription = await this.prisma.client.subscription.findUnique({
      where: { tenantId },
    });
    if (!subscription) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'No subscription found for this tenant.',
      });
    }
    const tenant = await this.prisma.client.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });
    const owner = await this.prisma.client.user.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    let stripeCustomerId = subscription.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripeService.createCustomer(
        tenantId,
        owner?.email ?? '',
        tenant.name,
      );
      stripeCustomerId = customer.id;
    }

    const stripeSubscription = await this.stripeService.upsertSubscription({
      customerId: stripeCustomerId,
      priceId: targetPlan.stripePriceId ?? 'price_stub',
      tenantId,
      existingSubscriptionId: subscription.stripeSubscriptionId,
    });

    const updated = await this.prisma.client.subscription.update({
      where: { tenantId },
      data: {
        planId: targetPlan.id,
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
        currentPeriodEnd: (stripeSubscription as any).current_period_end
          ? new Date((stripeSubscription as any).current_period_end * 1000)
          : null,
      },
    });
    await this.prisma.client.tenant.update({
      where: { id: tenantId },
      data: { currentPlanId: targetPlan.id },
    });

    return updated;
  }

  private async currentUsage(
    tenantId: string,
    metric: string,
  ): Promise<number> {
    switch (metric) {
      case 'staff_seats':
        return this.prisma.client.user.count({ where: { tenantId } });
      case 'product_count':
        return this.prisma.client.product.count({ where: { tenantId } });
      case 'order_volume': {
        const period = new Date().toISOString().slice(0, 7);
        const counter = await this.prisma.client.usageCounter.findUnique({
          where: { tenantId_metric_period: { tenantId, metric, period } },
        });
        return counter?.count ?? 0;
      }
      default:
        return 0;
    }
  }
}
