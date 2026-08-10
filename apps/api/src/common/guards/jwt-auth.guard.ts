import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Standard passport 'jwt' guard, with three additions:
 *  1. Requests already authenticated via `X-API-Key` (see api-key.guard.ts,
 *     which runs just before this guard) skip Passport-JWT entirely.
 *  2. `@Public()` routes skip enforcement entirely.
 *  3. After a token is verified, its `tenantId` claim is reconciled against
 *     whatever TenantResolverGuard (runs first — see app.module.ts's
 *     APP_GUARD order) already resolved from the Host header/subdomain:
 *       - if TenantResolverGuard found nothing (no subdomain signal —
 *         platform-level routes), adopt the JWT's own tenantId claim.
 *       - if TenantResolverGuard found a tenant AND the JWT is for a
 *         different one, reject — a tenant A user's token must not be
 *         usable against tenant B's subdomain, even if somehow both
 *         resolved to *something*.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    // Already authenticated via X-API-Key (see api-key.guard.ts, which runs
    // just before this guard) — skip Passport-JWT entirely.
    if (request.apiKeyAuthenticated) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(
    err: unknown,
    user: any,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest();
    const authedUser = super.handleRequest(err, user, info, context) as {
      tenantId: string | null;
      type?: string;
    };

    // Reject MFA challenge tokens — they're only valid for POST /auth/2fa/login.
    if ((authedUser as any).typ === 'mfa-challenge') {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'This token requires 2FA completion.',
      });
    }

    if (request.tenantId == null) {
      request.tenantId = authedUser.tenantId;
    } else if (
      authedUser.tenantId !== null &&
      request.tenantId !== authedUser.tenantId
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'This token is not valid for the resolved tenant.',
      });
    }

    return authedUser as TUser;
  }
}
