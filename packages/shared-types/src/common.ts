import { z } from "zod";

/** Standard error envelope — 06-api-specification.md "Conventions". */
export const errorCodes = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "TENANT_NOT_FOUND",
  "TENANT_SUSPENDED",
  "PLAN_LIMIT_EXCEEDED",
  "VALIDATION_ERROR",
  "RESOURCE_NOT_FOUND",
  "CONFLICT",
  "PAYMENT_FAILED",
  "RATE_LIMITED",
] as const;
export const errorCodeSchema = z.enum(errorCodes);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.array(z.unknown()).optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** Tenant lifecycle states — arch.md §9. */
export const tenantStatuses = ["trial", "active", "past_due", "suspended", "offboarded"] as const;
export const tenantStatusSchema = z.enum(tenantStatuses);
export type TenantStatus = z.infer<typeof tenantStatusSchema>;

/** Default tenant-level system roles — 03-roles-permission-matrix.md. Super Admin is platform-level, not tenant-scoped. */
export const systemRoles = ["owner", "admin", "manager", "staff"] as const;
export const systemRoleSchema = z.enum(systemRoles);
export type SystemRole = z.infer<typeof systemRoleSchema>;
