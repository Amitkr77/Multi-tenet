import { z } from "zod";

/** 01-functional-requirements.md §8 (FR-O-01/02), 06-api-specification.md §7. */

export const addCartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});
export type AddCartItemDto = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
});
export type UpdateCartItemDto = z.infer<typeof updateCartItemSchema>;
