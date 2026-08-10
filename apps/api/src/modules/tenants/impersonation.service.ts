/**
 * FR-P-06 (Super Admin impersonation) — the stub currently lives inline as
 * `TenantsService#impersonate` (throws, not implemented). This file is
 * reserved for the real implementation once built: issue a short-lived
 * (~15 min), non-renewable JWT scoped to the tenant's Owner role — same
 * `signAccessToken` shape as AuthService, plus an `impersonatedBy: <superAdminUserId>`
 * claim for audit purposes — and write an AUDIT_LOG entry
 * (`action: "tenant.impersonate"`) on issuance, per
 * 06-api-specification.md's endpoint note. Not built in Phase 1.
 */
export {};
