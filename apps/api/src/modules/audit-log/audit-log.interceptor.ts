/**
 * 07-folder-module-architecture.md reserves this file for an interceptor
 * that logs sensitive actions automatically. Phase 1 uses explicit
 * `AuditLogService#log(...)` calls at each sensitive-action call site instead
 * (roles.service.ts, tenants.service.ts's status-change path) — a generic
 * interceptor can infer *that* a mutating route ran, but not the precise
 * `action` label and business-meaningful `metadata` (e.g. `{ from: "active",
 * to: "suspended", reason }`) FR-AU-01 wants, without every route re-adding
 * metadata to `request` for the interceptor to read anyway — at which point
 * the explicit call is simpler and reads better at the call site.
 *
 * Revisit as an interceptor once enough call sites exist that the
 * boilerplate of explicit calls outweighs the metadata precision lost.
 */
export {};
