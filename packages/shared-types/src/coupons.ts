import { z } from "zod";

/** 01-functional-requirements.md §10 (FR-CP-01/02/03), 06-api-specification.md §10. */

export const couponTypeSchema = z.enum(["percentage", "fixed"]);

// An empty `<input type="number">` combined with react-hook-form's
// `valueAsNumber: true` produces `NaN`, not `undefined` — plain
// `.optional()` doesn't rescue a NaN (it's a real, present value, just not a
// valid one), which fails validation silently unless the form renders that
// specific field's error text. Same root cause as products.ts's
// `optionalUuid` for empty <select>s; this is the number-input equivalent.
function optionalNumber<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (typeof val === "number" && Number.isNaN(val) ? undefined : val), schema);
}

export const createCouponSchema = z.object({
  code: z.string().min(1).max(40).toUpperCase(),
  type: couponTypeSchema,
  value: z.number().nonnegative(),
  usageLimit: optionalNumber(z.number().int().positive().optional()),
  perCustomerLimit: optionalNumber(z.number().int().positive().optional()),
  minOrderValue: optionalNumber(z.number().nonnegative().optional()),
  restrictedProductIds: z.array(z.string().uuid()).default([]),
  restrictedCategoryIds: z.array(z.string().uuid()).default([]),
  expiresAt: z.coerce.date().optional(),
  isActive: z.boolean().default(true),
});
export type CreateCouponDto = z.infer<typeof createCouponSchema>;
export const updateCouponSchema = createCouponSchema.partial();
export type UpdateCouponDto = z.infer<typeof updateCouponSchema>;

// Public preview — checked again, authoritatively (incl. the per-customer
// limit, which needs an authenticated customer id), inside Checkout at
// order-creation time. This is a deliberate anonymous-capable "can I use
// this code?" preview, not the final word.
export const validateCouponSchema = z.object({
  code: z.string().min(1).max(40),
  subtotal: z.number().nonnegative(),
});
export type ValidateCouponDto = z.infer<typeof validateCouponSchema>;

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  discountAmount?: number;
}
