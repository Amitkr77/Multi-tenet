import { z } from "zod";

/**
 * Phase 6 — Outbound webhooks (tenant-configured delivery of platform
 * events, distinct from the INBOUND Stripe receivers in `queues.ts`'s
 * neighboring `webhooks/stripe/*` routes). A small, fixed, code-defined
 * vocabulary — not a user-managed taxonomy — same reasoning as
 * `CustomDomain`'s status field being a plain string enum rather than its
 * own lookup table.
 */
export const WEBHOOK_EVENT_TYPES = [
  "order.created",
  "order.status_changed",
  "product.created",
  "product.updated",
  "product.deleted",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const createWebhookSubscriptionSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
});
export type CreateWebhookSubscriptionDto = z.infer<
  typeof createWebhookSubscriptionSchema
>;

// PATCH replaces `eventTypes` wholesale when provided — same "simplest
// correct semantics for a low-traffic settings form" call as Plan's
// updatePlanSchema treating `limits` the same way.
export const updateWebhookSubscriptionSchema = z.object({
  url: z.string().url().optional(),
  eventTypes: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWebhookSubscriptionDto = z.infer<
  typeof updateWebhookSubscriptionSchema
>;
