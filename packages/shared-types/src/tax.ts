import { z } from "zod";

/** 01-functional-requirements.md §11 (FR-S-03), 06-api-specification.md §11. */

// An HTML <select> with a "—" (none) option submits an empty string, not
// `undefined` — same fix as products.ts's optionalUuid (see that file's
// comment for the full explanation).
const optionalUuid = z.preprocess((val) => (val === "" ? undefined : val), z.string().uuid().optional());

export const createTaxRuleSchema = z.object({
  region: z.string().min(1).max(60),
  rate: z.number().nonnegative().max(100), // percentage, e.g. 8.25
  categoryId: optionalUuid,
});
export type CreateTaxRuleDto = z.infer<typeof createTaxRuleSchema>;
export const updateTaxRuleSchema = createTaxRuleSchema.partial();
export type UpdateTaxRuleDto = z.infer<typeof updateTaxRuleSchema>;
