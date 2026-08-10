/**
 * Load-test data seeding — Load & Performance Testing Against NFR Targets.
 *
 * Plain Node.js (no ts-node / workspace linking needed): requires
 * packages/database's already-built `dist/` directly, exactly how apps/api
 * itself consumes `@saas/database` (compiled output, not source) — see that
 * package's package.json `"main": "./dist/index.js"`.
 *
 * Tenants are created via the REAL `/auth/register` HTTP endpoint (not a
 * direct Prisma insert) so each one gets the full, correct bootstrap: system
 * roles + permissions, a default warehouse, a default subscription — exactly
 * what a real signup produces, not a shortcut that could accidentally seed
 * data RLS/RBAC wouldn't actually allow in production.
 *
 * Products/variants/inventory/images/attribute values ARE seeded directly
 * via `createBasePrismaClient()` (the superuser/migrator role, bypasses RLS
 * entirely — same precedent as prisma/seed.ts) for speed: this is background
 * catalog volume to make GET /products non-trivial, not itself the thing
 * being measured (the benchmark's own requests go through the real HTTP
 * stack — see run.js).
 */
const path = require('node:path');
const crypto = require('node:crypto');
const db = require(
  path.join(__dirname, '../../packages/database/dist/index.js'),
);

const API_BASE = process.env.LOAD_TEST_API_BASE ?? 'http://localhost:3002/api/v1';
const TENANT_COUNT = Number(process.env.LOAD_TEST_TENANT_COUNT ?? 5);
const PRODUCTS_PER_TENANT = Number(process.env.LOAD_TEST_PRODUCTS_PER_TENANT ?? 2000);
const RUN_TAG = process.env.LOAD_TEST_RUN_TAG ?? String(Date.now());

async function registerTenant(i) {
  const subdomain = `loadtest-${i}-${RUN_TAG}`;
  const email = `owner-${i}@loadtest-${RUN_TAG}.example`;
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: `Load Test Store ${i}`,
      subdomain,
      email,
      password: 'LoadTestPass123!',
    }),
  });
  if (!res.ok) {
    throw new Error(
      `register tenant ${i} failed: ${res.status} ${await res.text()}`,
    );
  }
  const body = await res.json();
  return { tenantId: body.tenantId, subdomain, accessToken: body.tokens.accessToken };
}

async function seedCatalogForTenant(prisma, tenantId, productCount) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { tenantId, isDefault: true },
  });
  if (!warehouse) throw new Error(`No default warehouse for tenant ${tenantId}`);

  const category = await prisma.category.create({
    data: { tenantId, name: 'Load Test Category', slug: `load-test-category-${tenantId}` },
  });
  const brand = await prisma.brand.create({
    data: { tenantId, name: 'Load Test Brand', slug: `load-test-brand-${tenantId}` },
  });
  const attribute = await prisma.productAttribute.create({
    data: { tenantId, name: `Size-${tenantId.slice(0, 8)}` },
  });

  const products = [];
  const variants = [];
  const inventoryRows = [];
  const images = [];
  const attributeValues = [];

  for (let i = 0; i < productCount; i++) {
    const productId = crypto.randomUUID();
    const variantId = crypto.randomUUID();
    products.push({
      id: productId,
      tenantId,
      categoryId: category.id,
      brandId: brand.id,
      name: `Load Test Product ${i}`,
      slug: `load-test-product-${tenantId.slice(0, 8)}-${i}`,
      description: 'Seeded for load testing — not real catalog data.',
      basePrice: (9.99 + (i % 500)).toFixed(2),
      status: 'published',
    });
    variants.push({
      id: variantId,
      productId,
      tenantId,
      sku: `LT-${tenantId.slice(0, 8)}-${i}`,
      options: { size: 'M' },
    });
    inventoryRows.push({
      variantId,
      warehouseId: warehouse.id,
      tenantId,
      quantityOnHand: 100,
    });
    images.push({
      productId,
      tenantId,
      url: `https://example.invalid/load-test/${productId}.jpg`,
      key: `load-test/${productId}.jpg`,
      position: 0,
    });
    attributeValues.push({
      productId,
      tenantId,
      attributeId: attribute.id,
      value: 'M',
    });
  }

  // Batched createMany — one round-trip per batch of 500, not one per row.
  const BATCH = 500;
  for (let i = 0; i < products.length; i += BATCH) {
    await prisma.product.createMany({ data: products.slice(i, i + BATCH) });
  }
  for (let i = 0; i < variants.length; i += BATCH) {
    await prisma.productVariant.createMany({ data: variants.slice(i, i + BATCH) });
  }
  for (let i = 0; i < inventoryRows.length; i += BATCH) {
    await prisma.inventory.createMany({ data: inventoryRows.slice(i, i + BATCH) });
  }
  for (let i = 0; i < images.length; i += BATCH) {
    await prisma.productImage.createMany({ data: images.slice(i, i + BATCH) });
  }
  for (let i = 0; i < attributeValues.length; i += BATCH) {
    await prisma.productAttributeValue.createMany({ data: attributeValues.slice(i, i + BATCH) });
  }

  return products.length;
}

async function main() {
  const prisma = db.createBasePrismaClient();
  const tenants = [];

  console.log(`Registering ${TENANT_COUNT} tenants via ${API_BASE}/auth/register ...`);
  for (let i = 1; i <= TENANT_COUNT; i++) {
    const tenant = await registerTenant(i);
    tenants.push(tenant);
    console.log(`  tenant ${i}: ${tenant.tenantId} (${tenant.subdomain})`);
  }

  console.log(`Seeding ${PRODUCTS_PER_TENANT} products per tenant (${tenants.length} tenants) ...`);
  for (const tenant of tenants) {
    const count = await seedCatalogForTenant(prisma, tenant.tenantId, PRODUCTS_PER_TENANT);
    console.log(`  tenant ${tenant.tenantId}: ${count} products seeded`);
  }

  await prisma.$disconnect();

  // Emit the tenant list as JSON on stdout (last line) so run.js can consume it.
  console.log('LOAD_TEST_TENANTS_JSON=' + JSON.stringify(tenants));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
