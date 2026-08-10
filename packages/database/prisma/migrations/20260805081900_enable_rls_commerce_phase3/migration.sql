-- RLS for Phase 3 commerce tables. Same pattern as enable_rls_commerce
-- (Phase 2): every table here has a non-null tenant_id, so the policy is
-- the plain equality form — EXCEPT webhook_events, which is deliberately
-- excluded (see schema.prisma's comment on WebhookEvent): a webhook arrives
-- with no authenticated tenant context at all, so it's always written via
-- PrismaService.base outside any tenant scope, never the tenant-scoped
-- client — same precedent as customer_sessions (fixed to no-RLS in
-- fix_customer_sessions_no_rls after that migration originally, incorrectly,
-- gave it a policy). Getting it right the first time here.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "carts", "cart_items", "coupons", "coupon_redemptions", "shipping_zones",
  "shipping_rates", "tax_rules", "orders", "order_items", "payment_accounts",
  "payment_transactions", "refunds"
TO app_user;

-- webhook_events: app_user still needs to read/write it (webhook processing
-- runs as this role too) — just no RLS policy enforcing tenant scope on it.
GRANT SELECT, INSERT, UPDATE, DELETE ON "webhook_events" TO app_user;

ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "carts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "carts"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cart_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "cart_items"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupons" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "coupons"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupon_redemptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "coupon_redemptions"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "shipping_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipping_zones" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "shipping_zones"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "shipping_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipping_rates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "shipping_rates"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "tax_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tax_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tax_rules"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orders"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_items"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "payment_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payment_accounts"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payment_transactions"
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "refunds"
  USING (tenant_id = current_setting('app.tenant_id', true));

-- webhook_events: no ENABLE/FORCE ROW LEVEL SECURITY, no policy — deliberate.
