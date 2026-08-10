import { z } from "zod";

/** 01-functional-requirements.md §6, 06-api-specification.md §5. */

export const inventoryReasonCodeSchema = z.enum(["sale", "return", "damage", "manual_correction", "initial_stock"]);

export const adjustInventorySchema = z.object({
  delta: z.number().int(), // positive or negative
  reasonCode: inventoryReasonCodeSchema,
  note: z.string().max(500).optional(),
  warehouseId: z.string().uuid().optional(),
});
export type AdjustInventoryDto = z.infer<typeof adjustInventorySchema>;

export const setLowStockThresholdSchema = z.object({
  lowStockThreshold: z.number().int().nonnegative().nullable(),
});
export type SetLowStockThresholdDto = z.infer<typeof setLowStockThresholdSchema>;

export const transferInventorySchema = z.object({
  variantId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.number().int().positive(),
  note: z.string().max(500).optional(),
});
export type TransferInventoryDto = z.infer<typeof transferInventorySchema>;

export const createWarehouseSchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateWarehouseDto = z.infer<typeof createWarehouseSchema>;

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});
export type UpdateWarehouseDto = z.infer<typeof updateWarehouseSchema>;
