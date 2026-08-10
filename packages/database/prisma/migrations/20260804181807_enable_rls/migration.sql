-- Tenant isolation enforcement layer — arch.md §4.
--
-- Two Postgres roles:
--   * the owner role (whatever DATABASE_URL connects as, e.g. `postgres`) —
--     migrations/seed only, a superuser, and superusers ALWAYS bypass RLS
--     regardless of ENABLE/FORCE. That's exactly why the running app must
--     never connect through this role.
--   * `app_user` — NOSUPERUSER, and explicitly NOBYPASSRLS (belt-and-braces;
--     non-superuser non-owner roles are already subject to RLS by default,
--     but this makes the intent unmissable). This is who apps/api and
--     apps/worker actually connect as (DATABASE_URL_APP).
--
-- FORCE ROW LEVEL SECURITY is added on top of ENABLE even though app_user
-- isn't the table owner (so ENABLE alone would already be sufficient for it)
-- — defensive, in case ownership assumptions ever change.
DO $$
BEGIN
  CREATE ROLE app_user LOGIN PASSWORD 'change_me_in_env';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Policy shape, applied identically to every tenant-owned table below:
--
--   (tenant_id IS NULL AND current_setting('app.tenant_id', true) IS NULL)
--   OR (tenant_id = current_setting('app.tenant_id', true))
--
-- `current_setting(..., true)` — the `true` (missing_ok) argument returns
-- NULL instead of raising when no `SET LOCAL app.tenant_id` has run in the
-- current transaction (packages/database/src/tenant-extension.ts skips the
-- SET LOCAL entirely when there's no tenant context, e.g. public routes or a
-- platform Super Admin request). NULL = anything is NULL (falsy), so an
-- unset session var alone would deny every row — the explicit first clause
-- is what lets platform-level rows (tenant_id IS NULL — the Super Admin's
-- own User/Role) stay visible in that specific "no tenant context" case,
-- without ever leaking a real tenant's rows into it. A transaction that DOES
-- set app.tenant_id to tenant A only ever matches tenant A's rows — never
-- NULL-tenant rows, never tenant B's.
--
-- Known future extension point: true cross-tenant platform-wide reads (e.g.
-- FR-P-03/FR-P-05 aggregate analytics/audit views spanning ALL tenants at
-- once) aren't expressible with an equality policy and aren't in Phase 1's
-- API surface (06-api-specification.md's tenant audit-log endpoint is
-- per-tenant). When that's built, add a third OR clause keyed on a distinct,
-- narrowly-guarded session flag (e.g. current_setting('app.is_super_admin',
-- true) = 'true'), set only by a Super-Admin-checked code path — do not
-- relax the two clauses below to accommodate it.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING (
    (tenant_id IS NULL AND current_setting('app.tenant_id', true) IS NULL)
    OR (tenant_id = current_setting('app.tenant_id', true))
  );

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "roles"
  USING (
    (tenant_id IS NULL AND current_setting('app.tenant_id', true) IS NULL)
    OR (tenant_id = current_setting('app.tenant_id', true))
  );

ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_roles"
  USING (
    (tenant_id IS NULL AND current_setting('app.tenant_id', true) IS NULL)
    OR (tenant_id = current_setting('app.tenant_id', true))
  );

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs"
  USING (
    (tenant_id IS NULL AND current_setting('app.tenant_id', true) IS NULL)
    OR (tenant_id = current_setting('app.tenant_id', true))
  );

-- NOT RLS-protected, intentionally:
--   "tenants"              — this table IS the tenant; nothing to scope it by.
--   "sessions"              — isolation is via the user_id FK per the ERD, not tenant_id.
--   "plans", "permissions"  — global reference data.
--   "verification_tokens"   — isolation via user_id FK.
