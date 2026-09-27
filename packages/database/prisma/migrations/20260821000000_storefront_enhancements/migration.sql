-- Tenant branding fields
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "banner_url" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "primary_color" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "tagline" TEXT;

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('pending', 'answered', 'hidden');

-- CreateTable: wishlist_items (RLS-protected, same pattern as other tenant tables)
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: product_questions (RLS-protected)
CREATE TABLE "product_questions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" "QuestionStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_customer_id_product_id_key" ON "wishlist_items"("customer_id", "product_id");
CREATE INDEX "wishlist_items_tenant_id_idx" ON "wishlist_items"("tenant_id");
CREATE INDEX "wishlist_items_customer_id_idx" ON "wishlist_items"("customer_id");

CREATE INDEX "product_questions_tenant_id_idx" ON "product_questions"("tenant_id");
CREATE INDEX "product_questions_product_id_idx" ON "product_questions"("product_id");

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "wishlist_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_questions" ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as all other tenant-scoped tables in this schema)
CREATE POLICY "tenant_isolation_wishlist_items" ON "wishlist_items"
    USING (tenant_id = current_setting('app.tenant_id', TRUE))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', TRUE));

CREATE POLICY "tenant_isolation_product_questions" ON "product_questions"
    USING (tenant_id = current_setting('app.tenant_id', TRUE))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', TRUE));

-- GRANT to app_user (same pattern as all other tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON "wishlist_items" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "product_questions" TO app_user;
