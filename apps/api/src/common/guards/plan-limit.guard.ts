import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_LIMIT_METRIC_KEY } from '../decorators/enforce-plan-limit.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const METRIC_LABELS: Record<string, string> = {
  staff_seats: 'staff seats',
  product_count: 'products',
};

/**
 * Enforces `@EnforcePlanLimit(...)` — completes the scaffolded stub that
 * used to always return true (arch.md §7 / 07-folder-module-architecture.md
 * reserved this DI wiring point ahead of Phase 5's real Plan/PlanLimit
 * tables). Routes with no `@EnforcePlanLimit` decorator are not gated by
 * this guard, same "only ever narrows, never widens" discipline as RbacGuard.
 *
 * Effective limit resolution: an active (non-expired) `TenantPlanOverride`
 * for this tenant+metric wins if one exists; else the tenant's current
 * `Subscription.plan`'s `PlanLimit` row for that metric; else unlimited
 * (no row in either place — allow).
 */
@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metric = this.reflector.getAllAndOverride<string>(
      PLAN_LIMIT_METRIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!metric) return true;

    const request = context.switchToHttp().getRequest();
    const tenantId: string | null = request.tenantId ?? null;
    if (!tenantId) return true; // no tenant context (e.g. Super Admin route) — nothing to limit

    const limit = await this.resolveEffectiveLimit(tenantId, metric);
    if (limit == null) return true; // unlimited

    const count = await this.currentCount(tenantId, metric);
    if (count >= limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_EXCEEDED',
        message: `You've reached your plan's limit of ${limit} ${METRIC_LABELS[metric] ?? metric}. Upgrade your plan to add more.`,
      });
    }
    return true;
  }

  /**
   * Exported for CheckoutService's inline order_volume check to reuse — same
   * resolution order, no duplicated logic. Uses `runScoped` (an explicit
   * `SET LOCAL app.tenant_id` transaction), NOT `this.prisma.client` — this
   * method runs during the GUARD phase when called from `canActivate`, and
   * CLS/the tenant-scoping extension isn't populated until
   * TenantContextInterceptor runs (an INTERCEPTOR, which executes AFTER
   * guards in Nest's request lifecycle). `RbacGuard`/`resolveGrantedPermissions`
   * hit this identical problem first and established this same fix. Calling
   * it from CheckoutService (handler phase, CLS already populated) is just
   * redundant, not wrong.
   */
  async resolveEffectiveLimit(
    tenantId: string,
    metric: string,
  ): Promise<number | null> {
    return this.prisma.runScoped(tenantId, async (tx) => {
      const override = await tx.tenantPlanOverride.findFirst({
        where: { tenantId, metric, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      if (override) return override.overrideValue;

      const subscription = await tx.subscription.findUnique({
        where: { tenantId },
        include: { plan: { include: { limits: true } } },
      });
      const planLimit = subscription?.plan.limits.find(
        (l: { metric: string; maxValue: number }) => l.metric === metric,
      );
      return planLimit ? planLimit.maxValue : null;
    });
  }

  private async currentCount(
    tenantId: string,
    metric: string,
  ): Promise<number> {
    return this.prisma.runScoped(tenantId, (tx) => {
      switch (metric) {
        case 'staff_seats':
          // ALL User rows, not just isActive:true — isActive:false already
          // means both "pending invite" and "deactivated" (no way to tell
          // them apart today), so counting only active seats would let a
          // tenant invite unlimited pending seats then accept them all at
          // once, bypassing the gate entirely.
          return tx.user.count({ where: { tenantId } });
        case 'product_count':
          return tx.product.count({ where: { tenantId } });
        default:
          return Promise.resolve(0);
      }
    });
  }
}
