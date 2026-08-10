import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ErrorCode } from '@saas/shared-types';

/**
 * Maps every thrown exception onto 06-api-specification.md's error envelope:
 *   { "error": { "code": "...", "message": "...", "details": [...] } }
 *
 * Throw sites can either pass a plain string/object to Nest's built-in
 * exceptions (mapped to a code by HTTP status below) or throw with an
 * explicit `{ code, message, details }` body (e.g. ZodValidationPipe,
 * TenantResolverGuard) to pick a precise code the status-code fallback can't
 * express (TENANT_NOT_FOUND and TENANT_SUSPENDED are both 4xx-ish but need
 * distinct codes the client branches on).
 */
const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'RESOURCE_NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : undefined;

    let code: string = STATUS_TO_CODE[status] ?? 'INTERNAL_ERROR';
    let message = isHttp ? exception.message : 'Internal server error';
    let details: unknown[] | undefined;

    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      if (typeof b.code === 'string') code = b.code;
      if (typeof b.message === 'string') message = b.message;
      if (Array.isArray(b.details)) details = b.details;
      // Nest's default validation-pipe-style body shape: { message: string[] | string, error, statusCode }
      if (!details && Array.isArray(b.message))
        details = b.message as unknown[];
    }

    if (status >= 500) {
      this.logger.error(
        `Unhandled exception: ${message}`,
        isHttp ? undefined : (exception as Error)?.stack,
      );
    }

    response
      .status(status)
      .json({ error: { code, message, ...(details ? { details } : {}) } });
  }
}
