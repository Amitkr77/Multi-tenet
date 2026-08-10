-- RLS for Phase 6 round 1 (custom domains, outbound webhooks).
-- custom_domains/webhook_subscriptions/webhook_deliveries all have a
-- non-null tenant_id, so they get the standard simple-equality policy —
-- same as every Phase 2/3/4/5 tenant-scoped table.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "custom_domains", "webhook_subscriptions", "webhook_deliveries"
TO app_user;

ALTER TABLE "custom_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_domains" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "custom_domains"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "webhook_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "webhook_subscriptions"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_deliveries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "webhook_deliveries"
  USING (tenant_id = current_setting('app.tenant_id', true));
