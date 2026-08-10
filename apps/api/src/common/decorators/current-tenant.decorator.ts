import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * `@CurrentTenantId() tenantId: string | null` — the tenant resolved by
 * TenantResolverGuard for this request (from Host header subdomain, cross-
 * checked against the JWT's tenant claim). Null on platform Super Admin
 * routes, which have no tenant.
 */
export const CurrentTenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId ?? null;
  },
);
