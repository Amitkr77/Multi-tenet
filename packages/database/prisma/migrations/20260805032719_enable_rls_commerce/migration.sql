-- RLS for Phase 2 commerce tables. Same pattern as the Phase 1 enable_rls
-- migration, but simpler: every table here has a non-null tenant_id (no
-- platform-level/null-tenant case the way User/Role/AuditLog have for the
-- Super Admin), so the policy is the plain equality form with no
-- NULL-tenant OR clause.
--
-- Explicit GRANT here too (redundant with migration 1's ALTER DEFAULT
-- PRIVILEGES, which should already cover new tables created by the same
-- owner role — but explicit is safer than relying on that silently holding).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "categories", "brands", "products", "product_images", "product_variants",
  "product_attributes", "product_attribute_values", "warehouses", "inventory",
  "inventory_adjustments", "customers", "customer_addresses", "customer_sessions"
TO app_user;

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "categories"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brands" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brands"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "products"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_images" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product_images"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product_variants"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "product_attributes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_attributes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product_attributes"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "product_attribute_values" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_attribute_values" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product_attribute_values"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "warehouses"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "inventory_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_adjustments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_adjustments"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customers"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "customer_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_addresses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customer_addresses"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "customer_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customer_sessions"
  USING (tenant_id = current_setting('app.tenant_id', true));
