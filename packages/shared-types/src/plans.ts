import { z } from "zod";

/** 01-functional-requirements.md §1 (FR-P-04), 06-api-specification.md §14. */

export const planLimitInputSchema = z.object({
  metric: z.string().min(1),
  maxValue: z.number().int().nonnegative(),
});

export const createPlanSchema = z.object({
  name: z.string().min(1).max(120),
  price: z.number().nonnegative(),
  billingInterval: z.enum(["month", "year"]).default("month"),
  stripePriceId: z.string().optional(),
  isDefault: z.boolean().default(false),
  limits: z.array(planLimitInputSchema).default([]),
});
export type CreatePlanDto = z.infer<typeof createPlanSchema>;

// PATCH replaces `limits` wholesale when provided — simplest correct
// semantics for a low-traffic admin form (no partial-limit-list merging).
export const updatePlanSchema = createPlanSchema.partial();
export type UpdatePlanDto = z.infer<typeof updatePlanSchema>;
