import { z } from "zod";

/**
 * Public API — API-key management (`06-api-specification.md` new section).
 * No update schema — a key's `name`/scope can't be edited after creation,
 * only revoked and re-created (simplest correct semantics for a low-traffic
 * settings form, same call `Plan`'s `updatePlanSchema` made for `limits`).
 */
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateApiKeyDto = z.infer<typeof createApiKeySchema>;
