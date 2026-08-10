import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Public API — API-key authentication. Runs after TenantResolverGuard, before
 * JwtAuthGuard (see app.module.ts's APP_GUARD order).
 *
 * Absent `X-API-Key` header = pure no-op (`true`), zero effect on existing
 * JWT-authenticated traffic — this guard only ever acts when that header is
 * present.
 *
 * When present, this fully authenticates the request itself: it populates
 * the exact same `request.user`/`request.tenantId` fields a verified JWT
 * would (see jwt-auth.guard.ts's `handleRequest`), so every downstream guard
 * (RbacGuard, PlanLimitGuard) and decorator (CurrentUser, CurrentTenantId)
 * needs zero changes — they only ever read those two fields, never caring
 * which credential populated them. `request.apiKeyAuthenticated = true` is
 * the one signal JwtAuthGuard checks to skip its own Passport logic entirely.
 *
 * `api_keys` has NO RLS policy (same bootstrap reasoning as `CustomDomain` /
 * `Tenant` — this lookup runs with zero tenant context by definition, since
 * resolving the tenant IS what this query is for), so `prisma.base` is used,
 * matching TenantResolverGuard's own precedent for its bootstrap lookups.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers['x-api-key'];
    if (!rawKey || typeof rawKey !== 'string') return true;

    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.prisma.base.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
    });

    if (!apiKey) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or revoked API key.',
      });
    }
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'This API key has expired.',
      });
    }

    // Same "adopt if TenantResolverGuard found nothing, 403 if mismatched"
    // reconciliation JwtAuthGuard/CustomerJwtGuard both already implement —
    // a tenant A key must never be usable against tenant B's subdomain.
    if (request.tenantId == null) {
      request.tenantId = apiKey.tenantId;
    } else if (request.tenantId !== apiKey.tenantId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'This API key is not valid for the resolved tenant.',
      });
    }

    request.user = {
      userId: apiKey.userId,
      tenantId: apiKey.tenantId,
      email: '',
    };
    request.apiKeyAuthenticated = true;

    // Fire-and-forget — must never block or fail the request.
    this.prisma.base.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return true;
  }
}
