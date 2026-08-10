import { z } from "zod";

/** 01-functional-requirements.md §11 (FR-S-01/02), 06-api-specification.md §11. */

export const createShippingZoneSchema = z.object({
  name: z.string().min(1).max(120),
  // Country/state codes, e.g. ["US", "CA-BC"] — kept as a loose string array
  // rather than a structured region model; Phase 3 has no need to validate
  // real ISO codes yet, just to group rates under a named zone.
  regions: z.array(z.string().min(1).max(20)).min(1),
});
export type CreateShippingZoneDto = z.infer<typeof createShippingZoneSchema>;
export const updateShippingZoneSchema = createShippingZoneSchema.partial();
export type UpdateShippingZoneDto = z.infer<typeof updateShippingZoneSchema>;

export const shippingRateTypeSchema = z.enum(["flat_rate", "free_above_threshold"]);

// Flat-rate + free-above-threshold only (FR-S-02's weight-based option is
// scoped out for Phase 3 — see schema.prisma's ShippingRateType comment).
export const createShippingRateSchema = z.object({
  name: z.string().min(1).max(120),
  type: shippingRateTypeSchema,
  amount: z.number().nonnegative(),
  freeAboveAmount: z.number().nonnegative().optional(),
});
export type CreateShippingRateDto = z.infer<typeof createShippingRateSchema>;
export const updateShippingRateSchema = createShippingRateSchema.partial();
export type UpdateShippingRateDto = z.infer<typeof updateShippingRateSchema>;
