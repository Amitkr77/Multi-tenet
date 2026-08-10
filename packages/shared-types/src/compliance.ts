import { z } from "zod";

/**
 * Compliance — tenant data export (FR-AU-03, NFR-CP-01/02),
 * 06-api-specification.md §18. No request body — `POST /tenants/me/export`
 * takes no input at all (the caller is always "my own tenant," resolved
 * from the JWT, same as every other `/tenants/me/*` route).
 */
export const dataExportRequestSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  requestedByUserId: z.string().uuid().nullable(),
  status: z.enum(["pending", "ready", "failed"]),
  downloadUrl: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  readyAt: z.string().datetime().nullable(),
});
export type DataExportRequest = z.infer<typeof dataExportRequestSchema>;
