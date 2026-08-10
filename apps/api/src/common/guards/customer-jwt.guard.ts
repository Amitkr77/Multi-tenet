import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Explicitly applied via `@UseGuards(CustomerJwtGuard)` on storefront-auth
 * routes (never global — contrast with staff's JwtAuthGuard, which is an
 * APP_GUARD everything opts OUT of via `@Public()`). Those same routes are
 * additionally marked `@Public()` so the global JwtAuthGuard doesn't also
 * demand a staff Bearer token — the two guards compose: global chain skips
 * staff auth, this guard enforces customer auth in its place.
 *
 * Same Host-header/token tenant cross-check as JwtAuthGuard, but simpler:
 * customer tokens are never null-tenant (no Super-Admin-equivalent case),
 * so there's no "adopt if null" ambiguity to reconcile beyond the ordinary
 * case.
 */
@Injectable()
export class CustomerJwtGuard extends AuthGuard('customer-jwt') {
  handleRequest<TUser = any>(
    err: unknown,
    user: any,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest();
    const authedCustomer = super.handleRequest(err, user, info, context) as {
      tenantId: string;
    };

    if (request.tenantId == null) {
      request.tenantId = authedCustomer.tenantId;
    } else if (request.tenantId !== authedCustomer.tenantId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'This token is not valid for the resolved store.',
      });
    }

    return authedCustomer as TUser;
  }
}
