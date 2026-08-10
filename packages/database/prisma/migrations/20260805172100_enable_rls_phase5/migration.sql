-- RLS for Phase 5 (billing). subscriptions/invoices/usage_counters/
-- tenant_plan_overrides all have a non-null tenant_id, so they get the
-- standard simple-equality policy — same as every Phase 2/3/4 commerce
-- table. plan_limits is deliberately excluded: it belongs to a Plan, not a
-- tenant (no tenant_id column at all, same as plans itself).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "subscriptions", "invoices", "usage_counters", "tenant_plan_overrides"
TO app_user;

-- plan_limits: app_user still needs to read/write it (Plan CRUD runs as
-- this role too) — just no RLS policy, since there's no tenant to scope by.
GRANT SELECT, INSERT, UPDATE, DELETE ON "plan_limits" TO app_user;

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscriptions"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoices"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "usage_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_counters" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "usage_counters"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "tenant_plan_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_plan_overrides" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_plan_overrides"
  USING (tenant_id = current_setting('app.tenant_id', true));

-- plan_limits: no ENABLE/FORCE ROW LEVEL SECURITY, no policy — deliberate.
