/** BullMQ queue + job names shared between apps/api (producer) and apps/worker (consumer). */

export const QUEUE_NAMES = {
  email: "email",
  // Phase 5 — dunning's recurring grace-period check. A separate queue (not
  // piggybacked on `email`) since its job is a periodic DB query + status
  // transition, not a fire-and-forget notification — see
  // apps/worker/src/processors/dunning.processor.ts.
  billing: "billing",
  // Phase 6 — outbound webhook delivery (tenant-configured endpoints, NOT
  // the inbound Stripe receivers). A separate queue from `email` since each
  // job needs its own per-delivery retry/backoff configuration and a
  // 2xx/non-2xx outcome, not a fire-and-forget send — see
  // apps/worker/src/processors/webhook-delivery.processor.ts.
  webhookDelivery: "webhook-delivery",
  // Compliance — tenant data export (on-request or offboarding-triggered).
  // Originally planned to share one "compliance" queue with the retention
  // sweep below, corrected during implementation: a BullMQ Worker consumes
  // from its queue by name only — two separate `@Processor`-decorated
  // classes both bound to the same queue name would genuinely COMPETE for
  // each other's jobs (whichever worker instance has a free slot pulls the
  // next job, regardless of which Nest class registered it), not route by
  // job name the way one class's own `switch (job.name)` does. Every other
  // queue in this codebase already maps 1:1 with its consumer class for
  // exactly this reason — dataExport/dataRetention now follow suit.
  dataExport: "data-export",
  dataRetention: "data-retention",
} as const;

export const EMAIL_JOB_NAMES = {
  sendVerificationEmail: "send-verification-email",
  sendPasswordResetEmail: "send-password-reset-email",
  sendStaffInviteEmail: "send-staff-invite-email",
  sendOrderConfirmationEmail: "send-order-confirmation-email",
  sendPaymentFailedEmail: "send-payment-failed-email",
  sendAccountSuspendedEmail: "send-account-suspended-email",
  sendDataExportReadyEmail: "send-data-export-ready-email",
  sendDataDeletedEmail: "send-data-deleted-email",
} as const;

/** Phase 5 — apps/worker's DunningProcessor's own recurring/one-off job name. */
export const BILLING_JOB_NAMES = {
  checkPastDueTenants: "check-past-due-tenants",
} as const;

/** Phase 6 — apps/worker's WebhookDeliveryProcessor's job name. One job per delivery attempt-set (one WebhookDelivery row). */
export const WEBHOOK_DELIVERY_JOB_NAMES = {
  deliver: "deliver-webhook",
} as const;

/**
 * Compliance — apps/worker's DataExportProcessor (`generateExport`, one job
 * per `DataExportRequest`) and DataRetentionProcessor's own recurring/
 * one-off job name (`checkRetentionDeletes`, no payload needed — mirrors
 * `BILLING_JOB_NAMES.checkPastDueTenants`'s shape exactly, a cross-tenant
 * sweep with nothing to parameterize).
 */
export const COMPLIANCE_JOB_NAMES = {
  generateExport: "generate-data-export",
  checkRetentionDeletes: "check-retention-deletes",
} as const;

/** Job payload for COMPLIANCE_JOB_NAMES.generateExport — same "tenantId travels explicitly" reasoning as DeliverWebhookJob below (data_export_requests is RLS-protected, the worker has no CLS context). */
export interface GenerateExportJob {
  tenantId: string;
  exportRequestId: string;
}

/**
 * Job payload for WEBHOOK_DELIVERY_JOB_NAMES.deliver. `tenantId` travels
 * alongside `deliveryId` (not just a bare pointer) because
 * `webhook_deliveries`/`webhook_subscriptions` ARE RLS-protected (unlike
 * `tenants`, which DunningProcessor reads with no tenant context at all) —
 * the worker has no CLS/HTTP context to derive it from, so the one thing
 * that already knows it (WebhookDispatchService, at enqueue time) has to
 * pass it through explicitly. Everything else (subscription url/secret,
 * event payload) is still loaded from the DB, not duplicated here.
 */
export interface DeliverWebhookJob {
  tenantId: string;
  deliveryId: string;
}

export interface SendVerificationEmailJob {
  toEmail: string;
  verifyUrl: string;
}

export interface SendPasswordResetEmailJob {
  toEmail: string;
  resetUrl: string;
}

export interface SendStaffInviteEmailJob {
  toEmail: string;
  tenantName: string;
  acceptUrl: string;
}

export interface SendOrderConfirmationEmailJob {
  toEmail: string;
  orderId: string;
  tenantName: string;
  grandTotal: number;
  orderUrl: string;
}

export interface SendPaymentFailedEmailJob {
  toEmail: string;
  tenantName: string;
  invoiceUrl: string;
  gracePeriodEndsAt: string;
}

export interface SendAccountSuspendedEmailJob {
  toEmail: string;
  tenantName: string;
  billingUrl: string;
}

export interface SendDataExportReadyEmailJob {
  toEmail: string;
  tenantName: string;
  downloadUrl: string;
  expiresAt: string;
}

/** Sent by DataRetentionProcessor using owner email/tenant name captured BEFORE the tenant.delete() call — there's nothing left to look up afterward. */
export interface SendDataDeletedEmailJob {
  toEmail: string;
  tenantName: string;
}
