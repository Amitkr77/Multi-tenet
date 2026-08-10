import { z } from "zod";

/** 06-api-specification.md §14 — tenant-facing (not Super Admin) billing endpoints. */

export const upgradePlanSchema = z.object({
  planId: z.string().uuid(),
});
export type UpgradePlanDto = z.infer<typeof upgradePlanSchema>;
