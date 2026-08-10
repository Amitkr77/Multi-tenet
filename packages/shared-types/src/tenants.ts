import { z } from "zod";
import { tenantStatusSchema } from "./common";

/** 06-api-specification.md §2. */

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  logoUrl: z.string().url().optional(),
  currency: z.string().length(3).optional(), // ISO 4217
  timezone: z.string().optional(), // IANA tz name
});
export type UpdateTenantDto = z.infer<typeof updateTenantSchema>;

export const updateTenantStatusSchema = z.object({
  status: tenantStatusSchema,
  reason: z.string().min(1).max(500),
});
export type UpdateTenantStatusDto = z.infer<typeof updateTenantStatusSchema>;

/** FR-P-08 / TENANT_PLAN_OVERRIDE — Phase 5 feature, DTO reserved now so the
 * Phase-1 controller stub and the eventual Phase-5 implementation agree on shape. */
export const planOverrideSchema = z.object({
  metric: z.string().min(1),
  overrideValue: z.number().int(),
  reason: z.string().min(1).max(500),
  expiresAt: z.string().datetime(),
});
export type PlanOverrideDto = z.infer<typeof planOverrideSchema>;
