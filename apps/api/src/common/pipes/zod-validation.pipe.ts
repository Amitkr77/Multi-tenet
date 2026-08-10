import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates request bodies against a Zod schema shared with apps/web via
 * @saas/shared-types (NFR-M-05 — one source of truth for request shapes).
 * Throws NestJS's BadRequestException; http-exception.filter.ts maps it onto
 * the API spec's `{ error: { code: "VALIDATION_ERROR", details: [...] } }`
 * envelope.
 *
 * Usage: `@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto`
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.error.issues,
      });
    }
    return result.data;
  }
}
