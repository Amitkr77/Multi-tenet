-- Fixes a real, previously-latent bug in the null-tenant RLS carve-out
-- (affects `users`/`roles`/`user_roles`/`audit_logs` — the only tables with
-- both tenant-scoped rows and platform-level, tenant_id-IS-NULL rows, e.g.
-- the Super Admin's own User/Role rows).
--
-- Root cause (found during Phase 5 verification of Super Admin login):
-- `app.tenant_id` is a CUSTOM, application-defined GUC — Postgres has no
-- compiled-in definition for it. The FIRST time any transaction on a given
-- backend connection ever runs `SET LOCAL app.tenant_id = '<value>'`,
-- Postgres creates a "placeholder" GUC entry for that connection. `SET
-- LOCAL` correctly reverts the VALUE at COMMIT/ROLLBACK (transaction-scoped,
-- exactly as documented) — but it reverts to the placeholder's own reset
-- value, which for a custom GUC with no configured default is an EMPTY
-- STRING, not NULL. `current_setting('app.tenant_id', true) IS NULL` is
-- only ever true on a connection that has NEVER had the setting touched at
-- all. Since Prisma pools and reuses a small number of physical connections
-- across every request, ANY connection that has EVER served a real-tenant
-- query permanently reports '' (not NULL) from then on — breaking the
-- null-tenant carve-out for every subsequent null-tenant request that
-- happens to reuse that connection (in practice: after the pool "warms up",
-- effectively always). Confirmed directly against Postgres — not a
-- Prisma-level assumption:
--   BEGIN; SET LOCAL app.tenant_id = 'x'; COMMIT;
--   SELECT current_setting('app.tenant_id', true) IS NULL; -- returns FALSE, forever, on this connection
--
-- Fix: treat '' as an equally valid "no tenant" sentinel alongside NULL in
-- the policy itself (matches apps/api's PrismaService#runScoped and
-- packages/database's tenant-extension.ts, which now explicitly
-- `SET LOCAL app.tenant_id = ''` for the null-tenant case rather than
-- trying to coax Postgres back to a true NULL, which is not achievable
-- once a connection has been used at all).
ALTER POLICY tenant_isolation ON "users"
  USING (
    (tenant_id IS NULL AND (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = ''))
    OR (tenant_id = current_setting('app.tenant_id', true))
  );

ALTER POLICY tenant_isolation ON "roles"
  USING (
    (tenant_id IS NULL AND (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = ''))
    OR (tenant_id = current_setting('app.tenant_id', true))
  );

ALTER POLICY tenant_isolation ON "user_roles"
  USING (
    (tenant_id IS NULL AND (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = ''))
    OR (tenant_id = current_setting('app.tenant_id', true))
  );

ALTER POLICY tenant_isolation ON "audit_logs"
  USING (
    (tenant_id IS NULL AND (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = ''))
    OR (tenant_id = current_setting('app.tenant_id', true))
  );
