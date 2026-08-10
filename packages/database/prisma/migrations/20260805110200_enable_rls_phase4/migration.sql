-- RLS for Phase 4 (reviews). `reviews` has a non-null tenant_id like every
-- Phase 2/3 commerce table, so it gets the plain equality policy — no
-- carve-out needed (unlike webhook_events).
GRANT SELECT, INSERT, UPDATE, DELETE ON "reviews" TO app_user;

ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reviews"
  USING (tenant_id = current_setting('app.tenant_id', true));
