import { z } from "zod";

/** 01-functional-requirements.md §12 (FR-R-01/02), 06-api-specification.md §12. */

// Rating scale defaults to 1-5 — FR-R-01 doesn't specify a number; this is
// the standard e-commerce convention. Mirrored by a DB CHECK constraint
// (packages/database's enable_rls_phase4 migration) as defense-in-depth.
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});
export type CreateReviewDto = z.infer<typeof createReviewSchema>;

export const reviewStatusSchema = z.enum(["pending", "approved", "rejected", "hidden"]);

export const moderateReviewSchema = z.object({
  status: reviewStatusSchema.exclude(["pending"]),
});
export type ModerateReviewDto = z.infer<typeof moderateReviewSchema>;
