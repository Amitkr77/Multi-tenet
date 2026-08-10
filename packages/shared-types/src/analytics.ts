import { z } from "zod";

/**
 * 01-functional-requirements.md §13 (FR-AN-01..05), 06-api-specification.md §13.
 * No existing date-range filter precedent in the codebase before this
 * module — `from`/`to` are optional ISO 8601 datetimes (service defaults to
 * the last 30 days when absent); `granularity` controls bucketing for the
 * time-series endpoints (revenue/orders/customers-acquisition).
 */
export const dateRangeQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  granularity: z.enum(["day", "week", "month"]).default("day"),
});
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

export const analyticsExportTypeSchema = z.enum([
  "revenue",
  "orders",
  "best-sellers",
  "customers",
  "inventory",
]);
export type AnalyticsExportType = z.infer<typeof analyticsExportTypeSchema>;

export const analyticsExportQuerySchema = dateRangeQuerySchema.extend({
  type: analyticsExportTypeSchema,
  format: z.enum(["csv", "pdf"]),
});
export type AnalyticsExportQuery = z.infer<typeof analyticsExportQuerySchema>;
