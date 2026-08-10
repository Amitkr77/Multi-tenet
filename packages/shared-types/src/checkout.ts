import { z } from "zod";

/** 01-functional-requirements.md §8 (FR-O-03/04/05), 06-api-specification.md §7. */

export const shippingAddressInputSchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().min(2).max(60),
});
export type ShippingAddressInput = z.infer<typeof shippingAddressInputSchema>;

// Same shape for /checkout/quote and /checkout/complete — a preview and the
// real thing compute identically; totals are always recomputed server-side
// from the current cart/coupon/shipping/tax config, never trusted from the
// client either way.
export const checkoutRequestSchema = z.object({
  shippingAddress: shippingAddressInputSchema,
  couponCode: z.string().max(40).optional(),
});
export type CheckoutRequestDto = z.infer<typeof checkoutRequestSchema>;

export interface CheckoutQuote {
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  grandTotal: number;
}
