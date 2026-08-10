import { SetMetadata } from '@nestjs/common';

export const PLAN_LIMIT_METRIC_KEY = 'planLimitMetric';

/**
 * `@EnforcePlanLimit('staff_seats')` — checked by `PlanLimitGuard` against
 * the caller's tenant's effective limit for that metric (an active
 * `TenantPlanOverride` if one exists, else the current `Subscription.plan`'s
 * `PlanLimit` row, else unlimited). Mirrors `@RequirePermissions`'s
 * `SetMetadata` shape exactly. Only `staff_seats`/`product_count` are
 * enforced this way — `order_volume` is checked inline in
 * `CheckoutService.complete()` instead, since it must be atomic with the
 * order-creating write (see that file's own comment).
 */
export const EnforcePlanLimit = (metric: 'staff_seats' | 'product_count') =>
  SetMetadata(PLAN_LIMIT_METRIC_KEY, metric);
