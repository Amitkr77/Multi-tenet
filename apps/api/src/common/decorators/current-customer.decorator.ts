import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Shape attached by CustomerJwtStrategy#validate — see its file comment on the shared request.user slot. */
export interface AuthenticatedCustomer {
  customerId: string;
  tenantId: string;
  email: string;
}

/**
 * `@CurrentCustomer() customer: AuthenticatedCustomer` — only valid on routes
 * guarded by CustomerJwtGuard (never combined with staff's JwtAuthGuard/
 * @CurrentUser() on the same route, by convention across this codebase).
 * Nest/passport's plumbing always assigns a validated strategy's result to
 * `request.user` regardless of strategy name, so this reads the same
 * property @CurrentUser() does — the two are never used on the same route,
 * so there's no ambiguity about which shape is there.
 */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedCustomer => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
