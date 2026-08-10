import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { resolveGrantedPermissions } from '../permissions/granted-permissions';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Enforces `@RequirePermissions(...)` server-side — the ONLY security
 * boundary (03-roles-permission-matrix.md §5: client-side role checks are UI
 * convenience only). Routes with no `@RequirePermissions` decorator are not
 * gated by this guard (they rely on `@Public()` or plain JwtAuthGuard
 * authentication alone) — this guard only ever narrows, never widens, access.
 *
 * Runs after JwtAuthGuard (see app.module.ts's APP_GUARD order), so
 * `request.user` and `request.tenantId` are already populated and already
 * reconciled against each other.
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Authentication required.',
      });
    }

    const { permissions } = await resolveGrantedPermissions(
      this.prisma,
      user.userId,
      request.tenantId ?? null,
    );
    const granted = new Set(permissions);
    const missing = required.filter((code) => !granted.has(code));

    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Missing required permission(s): ${missing.join(', ')}`,
      });
    }
    return true;
  }
}
