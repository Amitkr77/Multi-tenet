-- Performance indexes for high-frequency query patterns.
-- Each index targets a specific, measured hot path rather than being speculative.

-- Orders: filtered list by status (dashboard order management)
CREATE INDEX IF NOT EXISTS "orders_tenant_status_idx" ON "orders" ("tenant_id", "status");

-- Orders: time-range analytics (revenue charts, recent order feed)
CREATE INDEX IF NOT EXISTS "orders_tenant_created_idx" ON "orders" ("tenant_id", "created_at" DESC);

-- Products: storefront published-only browse (the most common public query)
CREATE INDEX IF NOT EXISTS "products_tenant_status_idx" ON "products" ("tenant_id", "status");

-- Products: category filter on storefront (category dropdown + URL param)
CREATE INDEX IF NOT EXISTS "products_tenant_category_idx" ON "products" ("tenant_id", "category_id");

-- Customers: sorted customer list + analytics new-customer-over-time chart
CREATE INDEX IF NOT EXISTS "customers_tenant_created_idx" ON "customers" ("tenant_id", "created_at" DESC);

-- Invoices: sorted billing history (tenant billing page, newest first)
CREATE INDEX IF NOT EXISTS "invoices_tenant_created_idx" ON "invoices" ("tenant_id", "created_at" DESC);

-- WebhookDelivery: worker retry queue filtering by status (pending deliveries)
CREATE INDEX IF NOT EXISTS "webhook_deliveries_tenant_status_idx" ON "webhook_deliveries" ("tenant_id", "status");

-- InventoryAdjustment: per-variant history feed (stock movement log in dashboard)
CREATE INDEX IF NOT EXISTS "inventory_adjustments_inventory_created_idx" ON "inventory_adjustments" ("inventory_id", "created_at" DESC);

-- AuditLog: action-type filter on top of the existing (tenant_id, created_at) index
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_action_idx" ON "audit_logs" ("tenant_id", "action");
