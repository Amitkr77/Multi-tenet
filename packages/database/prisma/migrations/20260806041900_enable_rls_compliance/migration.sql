-- RLS for the compliance data-export feature. data_export_requests has a
-- non-null tenant_id, so it gets the standard simple-equality policy — same
-- as every Phase 2-6 tenant-scoped table.
GRANT SELECT, INSERT, UPDATE, DELETE ON "data_export_requests" TO app_user;

ALTER TABLE "data_export_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_export_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "data_export_requests"
  USING (tenant_id = current_setting('app.tenant_id', true));
