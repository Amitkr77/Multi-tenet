import { z } from "zod";

/**
 * Phase 6 — Custom Domains (FR-D-01..03, 06-api-specification.md §15).
 * A domain is a bare hostname (no scheme/path) — the tenant is asked to
 * point its own DNS at us, not the other way around, so this schema only
 * ever validates the hostname string itself.
 */
export const addDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(
      /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i,
      "must be a valid hostname, e.g. shop.example.com",
    ),
});
export type AddDomainDto = z.infer<typeof addDomainSchema>;
