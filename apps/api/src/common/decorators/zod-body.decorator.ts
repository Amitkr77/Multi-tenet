import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodSchema } from 'zod';

/**
 * Applied ALONGSIDE (never instead of) the existing
 * `@Body(new ZodValidationPipe(schema)) dto: any` pattern — this only adds
 * Swagger metadata, sourced from the exact same schema object used for
 * validation, so the documented request shape can never drift from what's
 * actually enforced. See zod-validation.pipe.ts for the runtime half.
 *
 * `schema as any` on the way into `zodToJsonSchema` is deliberate: passing
 * the real ZodSchema type makes TS try to fully resolve
 * zod-to-json-schema's recursive conditional return type against this
 * codebase's more deeply-nested schemas (optionals wrapping unions wrapping
 * records, etc.), which blows TS's instantiation depth limit (TS2589). The
 * runtime behavior is unaffected — only the input's static type is widened.
 */
export function ZodBody(schema: ZodSchema) {
  const jsonSchema = zodToJsonSchema(schema as any) as Record<string, unknown>;
  return applyDecorators(ApiBody({ schema: jsonSchema }));
}

/** Same idea as `ZodBody`, for the one `@Query(new ZodValidationPipe(...))` route. */
export function ZodQuery(schema: ZodSchema) {
  const jsonSchema = zodToJsonSchema(schema as any) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const properties = jsonSchema.properties ?? {};
  const required = new Set(jsonSchema.required ?? []);
  return applyDecorators(
    ...Object.entries(properties).map(([name, propSchema]) =>
      ApiQuery({
        name,
        required: required.has(name),
        schema: propSchema as Record<string, unknown>,
      }),
    ),
  );
}
