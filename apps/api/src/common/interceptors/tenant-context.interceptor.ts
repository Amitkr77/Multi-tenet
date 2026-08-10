import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PinoLogger } from 'nestjs-pino';
import type { Observable } from 'rxjs';
import {
  CLS_KEY_TENANT_ID,
  CLS_KEY_USER_ID,
  CLS_KEY_REQUEST_ID,
} from '../../prisma/tenant-context';

/**
 * Reads `request.tenantId` (set by TenantResolverGuard) and `request.user`
 * (set by JwtAuthGuard) — both guards have already run by the time an
 * interceptor executes — and publishes them onto the CLS store that
 * PrismaService's tenant-scoping extension reads from. This is the one place
 * "isolation" (feeding the Prisma extension) and "observability" (available
 * to a request-scoped logger) share a single code path, per arch.md §16.
 *
 * `PinoLogger#assign` binds these same fields onto the request's pino child
 * logger (nestjs-pino's documented pattern) — pino-http's own automatic
 * access-log line (method/path/status/duration) picks them up too, so one
 * call here covers both ad-hoc `Logger.log()` calls made later in the
 * request AND the final auto-logged HTTP line.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService,
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId ?? null;
    const userId = request.user?.userId ?? null;
    const requestId = request.id ?? null; // set by pino-http's genReqId (see app.module.ts)

    this.cls.set(CLS_KEY_TENANT_ID, tenantId);
    this.cls.set(CLS_KEY_USER_ID, userId);
    this.cls.set(CLS_KEY_REQUEST_ID, requestId);
    this.logger.assign({ tenantId, userId, requestId });

    return next.handle();
  }
}
