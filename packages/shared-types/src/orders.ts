import { z } from "zod";

/** 01-functional-requirements.md §8 (FR-O-06/07/08/09), 06-api-specification.md §8. */

export const orderStatusSchema = z.enum([
  "pending",
  "paid",
  "fulfilled",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const updateOrderStatusSchema = z
  .object({
    status: orderStatusSchema.optional(),
    trackingNumber: z.string().max(100).optional(),
    fulfillmentCarrier: z.string().max(100).optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.trackingNumber !== undefined || v.fulfillmentCarrier !== undefined,
    { message: "At least one of status, trackingNumber, or fulfillmentCarrier is required." },
  );
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;

// Omitted `amount` = full refund of whatever hasn't been refunded yet.
export const refundOrderSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
});
export type RefundOrderDto = z.infer<typeof refundOrderSchema>;
